import SwiftUI

enum CodeRoute: Hashable {
    case session(Int, item: Int? = nil)
    case new(project: String)
    case builds
    case devices
}

// Code app：左边是 session 列表，右边是对话；手机上收成一层层推进的导航
struct CodeRootView: View {
    @State private var store = CodeStore()
    @State private var route: CodeRoute?
    @State private var columns = NavigationSplitViewVisibility.automatic
    private let hub = EventHub.shared

    var body: some View {
        NavigationSplitView(columnVisibility: $columns) {
            SessionListView(store: store, route: $route)
        } detail: {
            NavigationStack {
                switch route {
                case .session(let id, let item):
                    ConversationView(store: store, sessionId: id, targetItem: item)
                        .id(route)
                case .new(let project):
                    ConversationView(store: store, sessionId: nil, project: project) { id, _ in
                        route = .session(id)
                    }
                    .id(route)
                case .builds:
                    BuildsView()
                case .devices:
                    DevicesView()
                case nil:
                    ContentUnavailableView("选择一个对话", systemImage: "bubble.left.and.bubble.right", description: Text("或者开始新对话"))
                }
            }
        }
        .task(id: hub.sessions + hub.projects) { await store.refreshSessions() }
        .task(id: hub.agent) { await store.refreshAgents() }
    }
}

struct SessionListView: View {
    let store: CodeStore
    @Binding var route: CodeRoute?
    @State private var query = ""
    @State private var results: SearchResponse?
    @State private var showArchived = false
    @State private var creatingProject = false
    @State private var renaming: SessionSummary?
    @State private var title = ""

    var body: some View {
        List(selection: $route) {
            if query.trimmingCharacters(in: .whitespaces).isEmpty {
                sessionSections
            } else {
                searchSection
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Code")
        .searchable(text: $query, prompt: "搜索对话与消息")
        .task(id: query) {
            let needle = query.trimmingCharacters(in: .whitespaces)
            guard !needle.isEmpty else {
                results = nil
                return
            }
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            results = try? await CodeAPI.search(needle)
        }
        .refreshable { await store.refreshSessions() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("新对话", systemImage: "square.and.pencil") { route = .new(project: "binos") }
            }
            ToolbarItem(placement: .secondaryAction) {
                Toggle("显示已归档", systemImage: "archivebox", isOn: $showArchived)
            }
            ToolbarItem(placement: .secondaryAction) {
                Button("创建项目", systemImage: "folder.badge.plus") { creatingProject = true }
            }
            ToolbarItem(placement: .secondaryAction) {
                Button("构建", systemImage: "hammer") { route = .builds }
            }
            ToolbarItem(placement: .secondaryAction) {
                Button("设备", systemImage: "iphone") { route = .devices }
            }
        }
        .sheet(isPresented: $creatingProject) {
            NewProjectSheet { project in route = .new(project: project.id) }
        }
        .alert("重命名", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField("标题", text: $title)
            Button("取消", role: .cancel) {}
            Button("保存") {
                if let id = renaming?.id, !title.trimmingCharacters(in: .whitespaces).isEmpty {
                    Task { await CodeAPI.edit(id, .init(title: title)) }
                }
            }
        }
        .overlay {
            if store.sessions == nil {
                if store.failed {
                    ContentUnavailableView("读取对话失败", systemImage: "wifi.exclamationmark", description: Text("下拉重试"))
                } else {
                    ProgressView()
                }
            }
        }
    }

    @ViewBuilder
    private var sessionSections: some View {
        Section {
            AgentStatusHeader(store: store)
        }
        let sessions = (store.sessions ?? []).filter { showArchived || !$0.archived }
        let pinned = sessions.filter(\.pinned)
        if !pinned.isEmpty {
            Section("置顶") {
                ForEach(pinned) { row($0) }
            }
        }
        ForEach(projectOrder(sessions), id: \.self) { project in
            Section {
                ForEach(sessions.filter { $0.project == project && !$0.pinned }) { row($0) }
            } header: {
                HStack {
                    Text(store.projectName(project))
                    Spacer()
                    Button("在 \(store.projectName(project)) 中新对话", systemImage: "plus") { route = .new(project: project) }
                        .labelStyle(.iconOnly)
                }
            }
        }
    }

    // 有对话的项目按最近的对话排，没有对话的项目排在后面
    private func projectOrder(_ sessions: [SessionSummary]) -> [String] {
        var order: [String] = []
        for session in sessions where !session.pinned && !order.contains(session.project) {
            order.append(session.project)
        }
        for project in store.projects where !order.contains(project.id) {
            order.append(project.id)
        }
        return order
    }

    private func row(_ session: SessionSummary) -> some View {
        NavigationLink(value: CodeRoute.session(session.id)) {
            SessionRow(session: session)
        }
        .swipeActions(edge: .trailing) {
            Button(session.archived ? "取消归档" : "归档", systemImage: "archivebox") {
                Task { await CodeAPI.edit(session.id, .init(archived: !session.archived)) }
            }
            .tint(.indigo)
        }
        .swipeActions(edge: .leading) {
            Button(session.pinned ? "取消置顶" : "置顶", systemImage: session.pinned ? "pin.slash" : "pin") {
                Task { await CodeAPI.edit(session.id, .init(pinned: !session.pinned)) }
            }
            .tint(.orange)
        }
        .contextMenu {
            Button("重命名", systemImage: "pencil") {
                title = session.title
                renaming = session
            }
            Button(session.pinned ? "取消置顶" : "置顶", systemImage: "pin") {
                Task { await CodeAPI.edit(session.id, .init(pinned: !session.pinned)) }
            }
            Button(session.archived ? "取消归档" : "归档", systemImage: "archivebox") {
                Task { await CodeAPI.edit(session.id, .init(archived: !session.archived)) }
            }
        }
    }

    @ViewBuilder
    private var searchSection: some View {
        if let results {
            Section(results.total > results.results.count ? "找到 \(results.total) 处，显示前 \(results.results.count) 处" : "找到 \(results.total) 处") {
                ForEach(Array(results.results.enumerated()), id: \.offset) { _, result in
                    NavigationLink(value: CodeRoute.session(result.id, item: result.item)) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(result.title).font(.subheadline.weight(.semibold)).lineLimit(1)
                                if result.archived { Image(systemName: "archivebox").foregroundStyle(.secondary) }
                            }
                            if result.kind != "title" {
                                (Text(result.before) + Text(result.match).bold().foregroundStyle(.tint) + Text(result.after))
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(3)
                            }
                        }
                    }
                }
            }
        } else {
            HStack { Spacer(); ProgressView(); Spacer() }
        }
    }
}

private struct SessionRow: View {
    let session: SessionSummary

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            statusIcon
                .frame(width: 18)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 3) {
                Text(session.title.isEmpty ? "新对话" : session.title)
                    .font(.body.weight(session.unread ? .semibold : .regular))
                    .lineLimit(2)
                HStack(spacing: 6) {
                    Text(session.updated, format: .relative(presentation: .named))
                    if let model = session.model {
                        Text(Agents.modelName(session.agent, model))
                    }
                    if let pr = session.prs.last {
                        Label("#\(pr.number)", systemImage: pr.state == "merged" ? "arrow.triangle.merge" : "arrow.triangle.pull")
                            .foregroundStyle(pr.state == "merged" ? .purple : pr.state == "closed" ? .secondary : .green)
                    }
                    if !session.queue.isEmpty {
                        Label("\(session.queue.count)", systemImage: "clock")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
        }
    }

    @ViewBuilder
    private var statusIcon: some View {
        if session.running {
            ProgressView().controlSize(.small)
        } else if session.waiting {
            Image(systemName: "hourglass").foregroundStyle(.orange)
        } else if session.unread {
            Circle().fill(.tint).frame(width: 9, height: 9).padding(.top, 4)
        } else if session.outcome == "error" {
            Image(systemName: "exclamationmark.circle").foregroundStyle(.red)
        } else if session.outcome == "stopped" {
            Image(systemName: "stop.circle").foregroundStyle(.secondary)
        } else if session.pinned {
            Image(systemName: "pin.fill").foregroundStyle(.orange).font(.caption)
        } else {
            Color.clear
        }
    }
}

// 列表顶部：各个 agent 的额度，以及登录需要处理的提醒
struct AgentStatusHeader: View {
    let store: CodeStore

    var body: some View {
        if let status = store.status {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(status.limits.keys.sorted(), id: \.self) { agent in
                    if let limits = status.limits[agent] {
                        QuotaRow(agent: agent, limits: limits)
                    }
                }
                if let attention = AgentAttention.claude(status.auth.claude) {
                    Label(attention, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.orange).font(.footnote)
                }
                if let codex = status.auth.codex, !codex.loggedIn || codex.broken == true {
                    Label(codex.broken == true ? "Codex 的登录失效了" : "Codex 没有登录", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                        .font(.footnote)
                }
            }
        }
    }
}

struct QuotaRow: View {
    let agent: String
    let limits: Limits

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(Agents.name(agent)).font(.footnote.weight(.semibold))
                if limits.limited { Text("已限流").font(.caption).foregroundStyle(.red) }
            }
            ForEach(limits.windows, id: \.id) { window in
                let current = window.resetsAt > Date.now.timeIntervalSince1970 ? window.utilization : 0
                HStack(spacing: 8) {
                    Text(QuotaFormat.name(window)).frame(width: 64, alignment: .leading)
                    ProgressView(value: min(current, 1))
                        .tint(current >= 0.95 || limits.limited ? .red : current >= 0.8 ? .orange : .accentColor)
                    Text(Format.percent(current)).monospacedDigit().frame(width: 40, alignment: .trailing)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
    }
}

enum QuotaFormat {
    // 5 小时、7 天，同样长的窗口不止一个时带上它的 label
    static func name(_ window: QuotaWindow) -> String {
        let minutes = window.minutes
        let length = minutes % (24 * 60) == 0 ? "\(minutes / 24 / 60) 天" : minutes % 60 == 0 ? "\(minutes / 60) 小时" : "\(minutes) 分钟"
        return window.label.map { "\($0) \(length)" } ?? length
    }
}

enum AgentAttention {
    static func claude(_ auth: ClaudeAuth?) -> String? {
        guard let auth else { return nil }
        if auth.mode == "none" { return "Claude 没有能用的登录" }
        if auth.mode == "token" { return auth.login?.broken == true ? "Claude 的登录失效了，正在用备用 token" : "Claude 的登录过期了，正在用备用 token" }
        if let expiry = auth.login?.expiresAt.flatMap(Date.init(iso:)), expiry.timeIntervalSinceNow < 7 * 86400 {
            let days = max(Int(expiry.timeIntervalSinceNow / 86400), 0)
            return "Claude 的登录\(days == 0 ? "今天" : "还有 \(days) 天")到期"
        }
        return nil
    }
}

private struct NewProjectSheet: View {
    let onCreated: (Project) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var repository = ""
    @State private var create = false
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                TextField("项目名称", text: $name)
                Picker("仓库来源", selection: $create) {
                    Text("关联已有仓库").tag(false)
                    Text("创建私有 GitHub 仓库").tag(true)
                }
                TextField("owner/repository", text: $repository)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if let error {
                    Text(error).foregroundStyle(.red)
                }
            }
            .navigationTitle("创建项目")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("创建") { save() }
                            .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || repository.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
        }
    }

    private func save() {
        saving = true
        error = nil
        Task {
            do {
                let project = try await CodeAPI.createProject(name: name.trimmingCharacters(in: .whitespaces), repository: repository.trimmingCharacters(in: .whitespaces), create: create)
                dismiss()
                onCreated(project)
            } catch {
                self.error = error.localizedDescription
            }
            saving = false
        }
    }
}
