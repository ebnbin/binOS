import SwiftUI

// 对话内容：按块排列，回答进行中的临时内容接在最后
struct TranscriptView: View {
    let stream: KitaSessionStream
    let blocks: [Block]
    let index: TranscriptIndex
    // 长对话只排最近的这么多块，往上翻时再加
    @Binding var limit: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if blocks.count > limit {
                Button("显示更早的 \(min(blocks.count - limit, 60)) 项", systemImage: "arrow.up") { limit += 60 }
                    .font(.footnote)
                    .frame(maxWidth: .infinity)
                    .buttonStyle(.bordered)
            }
            ForEach(blocks.suffix(limit)) { block in
                BlockRow(block: block, context: context, isLast: block == blocks.last)
                    .id(block.id)
            }
            if let live = stream.live {
                LiveTail(live: live, stream: stream, index: index)
                    .id("live")
            }
        }
        .scrollTargetLayout()
    }

    private var context: TranscriptContext {
        TranscriptContext(thread: stream.thread, agent: stream.agent, index: index, live: stream.live)
    }
}

struct TranscriptContext {
    let thread: String
    let agent: String?
    let index: TranscriptIndex
    let live: Live?
}

private struct BlockRow: View {
    let block: Block
    let context: TranscriptContext
    let isLast: Bool

    var body: some View {
        switch block {
        case .time(_, let date):
            Text(date.formatted(.dateTime.month().day().weekday().hour().minute()))
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
        case .input(_, let entry):
            UserBubble(entry: entry)
        case .attachments(_, let attachments):
            AttachmentStrip(thread: context.thread, attachments: attachments)
                .frame(maxWidth: .infinity, alignment: .trailing)
        case .text(_, let text, let files):
            MarkdownView(text: text, files: files, thread: context.thread)
        case .steps(_, let steps):
            StepsView(steps: steps, context: context, expandedByDefault: context.live != nil && isLast)
        case .divider(_, let text):
            DividerLabel(text: text)
        case .turnEnd(_, let entry, let reply, let edits):
            TurnEndView(entry: entry, reply: reply, edits: edits, context: context)
        }
    }
}

struct DividerLabel: View {
    let text: String

    var body: some View {
        HStack {
            VStack { Divider() }
            Text(text).font(.caption).foregroundStyle(.secondary).fixedSize()
            VStack { Divider() }
        }
    }
}

private struct UserBubble: View {
    let entry: InputEntry

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text(entry.text)
                .textSelection(.enabled)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.accentColor.opacity(0.15), in: .rect(cornerRadius: 18))
            if let date = Date(iso: entry.time) {
                Text(date.formatted(date: .omitted, time: .shortened))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .padding(.leading, 40)
        .contextMenu {
            Button("复制", systemImage: "doc.on.doc") { UIPasteboard.general.string = entry.text }
        }
    }
}

struct AttachmentStrip: View {
    let thread: String
    let attachments: [Attachment]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(attachments, id: \.file) { attachment in
                    Button {
                        FilePresenter.shared.present(url: CodeAPI.sessionFileURL(thread: thread, file: attachment.file), name: attachment.name)
                    } label: {
                        if FileKind.isImage(attachment.name) {
                            RemoteImage(url: CodeAPI.sessionFileURL(thread: thread, file: attachment.file), contentMode: .fill)
                                .frame(width: 72, height: 72)
                                .clipShape(.rect(cornerRadius: 10))
                        } else {
                            Label(attachment.name, systemImage: FileKind.icon(attachment.name))
                                .font(.footnote)
                                .lineLimit(1)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 8)
                                .background(.quaternary, in: .rect(cornerRadius: 10))
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}

// 连续的几步：最多只有一次工具调用时直接显示；多次时收成一行「已工作 …」，正在进行的那一组展开
struct StepsView: View {
    let steps: [Step]
    let context: TranscriptContext
    let expandedByDefault: Bool
    @State private var userExpanded: Bool?

    var body: some View {
        let states = steps.compactMap(\.state)
        if states.count <= 1 {
            stepList
        } else {
            let expanded = userExpanded ?? expandedByDefault
            VStack(alignment: .leading, spacing: 8) {
                Button {
                    withAnimation(.snappy) { userExpanded = !expanded }
                } label: {
                    HStack(spacing: 6) {
                        summary(states)
                        Image(systemName: "chevron.right")
                            .font(.caption2.bold())
                            .rotationEffect(.degrees(expanded ? 90 : 0))
                    }
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                if expanded {
                    stepList
                        .padding(.leading, 10)
                        .overlay(alignment: .leading) { Rectangle().fill(.quaternary).frame(width: 2) }
                }
            }
        }
    }

    private var stepList: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(steps) { step in
                switch step {
                case .thinking(_, _, let text, let durationMs):
                    ThinkingView(text: text, durationMs: durationMs, live: false)
                case .tool(let state):
                    ToolCallView(state: state, context: context)
                case .subagent(let state):
                    SubagentView(state: state, context: context)
                }
            }
        }
    }

    private func summary(_ states: [CallState]) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            let running = states.contains { $0.status == .running }
            let errors = states.count { $0.status == .error }
            let start: Date? = {
                guard let first = steps.first else { return nil }
                switch first {
                case .thinking(_, let time, _, let durationMs): return Date(iso: time).map { $0.addingTimeInterval(-(durationMs ?? 0) / 1000) }
                case .tool(let state), .subagent(let state): return Date(iso: state.call.time)
                }
            }()
            let end = steps.compactMap { step -> Date? in
                switch step {
                case .thinking(_, let time, _, _): return Date(iso: time)
                case .tool(let state), .subagent(let state):
                    if let result = state.result { return Date(iso: result.time) }
                    return running ? timeline.date : Date(iso: state.call.time)
                }
            }.max()
            let elapsed = start.flatMap { start in end.map { max($0.timeIntervalSince(start), 0) } } ?? 0
            HStack(spacing: 4) {
                if running { ProgressView().controlSize(.mini) }
                Text("\(running ? "正在工作" : "已工作") \(Format.duration(elapsed)) · \(StepSummary.text(steps))")
                if errors > 0 {
                    Text("· \(errors) 个出错").foregroundStyle(.red)
                }
            }
            .multilineTextAlignment(.leading)
        }
    }
}

struct ThinkingView: View {
    let text: String
    let durationMs: Double?
    let live: Bool
    @State private var expanded = false

    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            MarkdownView(text: text)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(.top, 4)
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "brain")
                if live {
                    Text("思考中").shimmering()
                } else if let durationMs {
                    Text("思考了 \(Format.duration(durationMs / 1000))")
                } else {
                    Text("思考")
                }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .tint(.secondary)
    }
}

private struct LiveTail: View {
    let live: Live
    let stream: KitaSessionStream
    let index: TranscriptIndex

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !live.thinking.isEmpty {
                ThinkingView(text: live.thinking, durationMs: nil, live: true)
            }
            if !live.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                MarkdownView(text: live.text, files: live.files, thread: stream.thread)
            }
            TimelineView(.periodic(from: .now, by: 1)) { timeline in
                HStack(spacing: 6) {
                    ProgressView().controlSize(.small)
                    Text(statusText + elapsed(timeline.date))
                        .shimmering()
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
        }
    }

    // 主对话里还没有结果的最后一次工具调用
    private var runningTool: String? {
        for item in index.main.reversed() {
            if case .toolCall(let call) = item.entry, index.results[item.index] == nil { return call.name }
        }
        return nil
    }

    private var statusText: String {
        switch live.status {
        case .requesting: "等待模型"
        case .thinking: "思考中"
        case .tool(let name): "正在调用 \(name)"
        case .compacting: "正在压缩上下文"
        case .waiting(let tasks): "已答完，等待 \(tasks) 个后台任务"
        case .retrying(let attempt): "请求失败，第 \(attempt) 次重试"
        default: !live.text.isEmpty ? "正在回答" : runningTool.map { "正在运行 \($0)" } ?? "正在处理"
        }
    }

    private func elapsed(_ now: Date) -> String {
        for entry in stream.items.reversed() {
            if case .input(let input) = entry, input.mode == "start", let start = Date(iso: input.time) {
                let seconds = max(Int(now.timeIntervalSince(start)), 0)
                return seconds < 60 ? " · \(seconds) 秒" : " · \(seconds / 60) 分 \(seconds % 60) 秒"
            }
        }
        return ""
    }
}

// 一轮的结尾：停止、出错，以及这一轮的统计
private struct TurnEndView: View {
    let entry: TurnEndEntry
    let reply: String
    let edits: [CallState]
    let context: TranscriptContext

    var body: some View {
        let files = ChangedFile.collect(edits)
        VStack(alignment: .leading, spacing: 10) {
            if !files.isEmpty {
                TurnChangesView(files: files, context: context)
            }
            if entry.outcome == "stopped" {
                DividerLabel(text: "已停止 · 用时 \(Format.duration(entry.durationMs / 1000))")
            } else {
                if entry.outcome == "error" {
                    Label(entry.error ?? "agent 出错了", systemImage: "exclamationmark.triangle.fill")
                        .font(.callout)
                        .foregroundStyle(.red)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.red.opacity(0.1), in: .rect(cornerRadius: 10))
                }
                HStack(spacing: 8) {
                    Text(stats)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    if !reply.isEmpty { CopyButton(text: reply).foregroundStyle(.tertiary) }
                }
            }
        }
    }

    private var stats: String {
        var parts: [String] = []
        if let date = Date(iso: entry.time) { parts.append(date.formatted(date: .omitted, time: .shortened)) }
        parts.append("用时 \(Format.duration(entry.durationMs / 1000))")
        if let tokens = entry.outputTokens { parts.append("输出 \(Format.tokens(tokens)) token") }
        if let context = entry.context, context.window > 0 { parts.append("上下文 \(context.tokens * 100 / context.window)%") }
        if let model = entry.model { parts.append(context.agent.map { Agents.modelName($0, model) } ?? model) }
        return parts.joined(separator: " · ")
    }
}

// 这一轮改了哪些文件，点开看每个文件的改动
private struct TurnChangesView: View {
    let files: [ChangedFile]
    let context: TranscriptContext

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("改动了 \(files.count) 个文件")
                .font(.footnote.weight(.semibold))
                .padding(10)
            ForEach(files) { file in
                Divider()
                NavigationLink {
                    FileChangesPage(file: file)
                } label: {
                    HStack {
                        Image(systemName: file.op == "add" ? "doc.badge.plus" : file.op == "delete" ? "doc.badge.minus" : "doc")
                            .foregroundStyle(.secondary)
                        Text((file.path as NSString).lastPathComponent)
                            .lineLimit(1)
                        Spacer()
                        Text("+\(file.added)").foregroundStyle(.green)
                        Text("−\(file.removed)").foregroundStyle(.red)
                        Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.tertiary)
                    }
                    .font(.footnote.monospacedDigit())
                    .padding(10)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
    }
}

struct FileChangesPage: View {
    let file: ChangedFile

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(file.path)
                    .font(.footnote.monospaced())
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                ForEach(file.calls) { state in
                    if case .edit(_, let change?) = state.call.tool {
                        DiffView(lines: Diff.lines(for: change))
                    }
                }
            }
            .padding()
        }
        .navigationTitle((file.path as NSString).lastPathComponent)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct DiffView: View {
    let lines: [DiffLine]
    var limit = 2000

    var body: some View {
        ScrollView(.horizontal) {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(lines.prefix(limit)) { line in
                    HStack(spacing: 6) {
                        Text(symbol(line.kind))
                            .foregroundStyle(color(line.kind))
                            .frame(width: 10)
                        Text(line.text.isEmpty ? " " : line.text)
                    }
                    .font(.system(.caption, design: .monospaced))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(color(line.kind).opacity(line.kind == .context ? 0 : 0.12))
                }
                if lines.count > limit {
                    Text("还有 \(lines.count - limit) 行未显示").font(.caption).foregroundStyle(.secondary).padding(8)
                }
            }
            .padding(.vertical, 6)
        }
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 10))
    }

    private func symbol(_ kind: DiffLine.Kind) -> String {
        switch kind {
        case .added: "+"
        case .removed: "−"
        case .header: "@"
        case .context: " "
        }
    }

    private func color(_ kind: DiffLine.Kind) -> Color {
        switch kind {
        case .added: .green
        case .removed: .red
        case .header: .blue
        case .context: .primary
        }
    }
}

extension View {
    // 进行中的文字的微光效果
    func shimmering() -> some View {
        modifier(Shimmer())
    }
}

private struct Shimmer: ViewModifier {
    @State private var phase = false

    func body(content: Content) -> some View {
        content
            .opacity(phase ? 0.45 : 1)
            .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: phase)
            .onAppear { phase = true }
    }
}

enum FileKind {
    static func ext(_ name: String) -> String { (name as NSString).pathExtension.lowercased() }

    static func isImage(_ name: String) -> Bool {
        ["png", "jpg", "jpeg", "gif", "webp", "heic", "bmp", "avif"].contains(ext(name))
    }

    static func icon(_ name: String) -> String {
        switch ext(name) {
        case "png", "jpg", "jpeg", "gif", "webp", "heic", "bmp", "avif", "svg": "photo"
        case "mp4", "mov", "webm", "m4v": "film"
        case "mp3", "wav", "m4a", "ogg", "flac": "music.note"
        case "pdf": "doc.richtext"
        case "zip", "gz", "tar", "tgz", "7z", "rar": "archivebox"
        case "md", "txt", "log": "doc.plaintext"
        case "swift", "ts", "tsx", "js", "jsx", "py", "rb", "rs", "go", "java", "kt", "c", "cpp", "h", "sh", "json", "yaml", "yml", "css", "html": "chevron.left.forwardslash.chevron.right"
        default: "doc"
        }
    }
}
