import SwiftUI

struct DevicesSnapshot: Decodable {
    struct Device: Decodable, Hashable, Identifiable {
        let id: String
        let platform: String
        let name: String
        let target: String
        let system: String?
        let status: String
        let error: String?
    }

    struct Lease: Decodable, Hashable, Identifiable {
        let requestId: String
        let claimed: Bool?
        let id: String
        let owner: String
        let reason: String
        let platforms: [String]
        let devices: [String]
        let createdAt: Double
    }

    struct Waiting: Decodable, Hashable, Identifiable {
        let id: String
        let owner: String
        let reason: String
        let platforms: [String]
        let phase: String
        let error: String?
    }

    struct Event: Decodable, Hashable {
        let time: Double
        let text: String
    }

    struct Owner: Decodable, Hashable {
        let session: Int
        let title: String
    }

    let devices: [Device]
    let leases: [Lease]
    let queue: [Waiting]
    let events: [Event]
    let capacity: Int
    let mode: String
    let owners: [String: Owner]
}

// 设备：开发验证用的模拟器池，可以手动申请、归还、看截图
struct DevicesView: View {
    @State private var snapshot: DevicesSnapshot?
    @State private var error: String?
    @State private var platform = "both"
    @State private var reason = "手动验证"
    // 手动申请的编号：排队时每 30 秒重新申请一次保活
    @AppStorage("devices/request") private var requestId = ""
    @State private var screenshot: (id: String, image: UIImage)?
    private let hub = EventHub.shared

    private var manualLease: DevicesSnapshot.Lease? { snapshot?.leases.first { $0.owner == "manual" } }
    private var manualWaiting: DevicesSnapshot.Waiting? { snapshot?.queue.first { $0.owner == "manual" && $0.id == requestId } }

    var body: some View {
        List {
            if let snapshot {
                Section {
                    LabeledContent("设备池", value: "\(snapshot.devices.count) / \(snapshot.capacity)")
                    LabeledContent("闲置", value: "\(snapshot.devices.count { $0.status == "free" })")
                    LabeledContent("租约", value: "\(snapshot.leases.count)")
                    if snapshot.mode == "mock" { Text("模拟模式").foregroundStyle(.secondary) }
                }
                Section("手动申请") {
                    if let lease = manualLease {
                        Text("正在使用：\(lease.devices.joined(separator: "、"))").font(.footnote)
                        Button("归还我的设备", role: .destructive) { Task { await post("/leases/\(lease.id)/release") } }
                    } else if let waiting = manualWaiting {
                        Text(waiting.phase == "failed" ? (waiting.error ?? "申请失败") : "排队中").font(.footnote)
                        Button("取消申请", role: .destructive) {
                            struct Body: Encodable { let requestId: String }
                            Task { await post("/queue/cancel", body: Body(requestId: requestId)) }
                        }
                    } else {
                        Picker("平台", selection: $platform) {
                            Text("Android + iOS").tag("both")
                            Text("Android").tag("android")
                            Text("iOS").tag("ios")
                        }
                        TextField("用途", text: $reason)
                        Button("申请设备") {
                            requestId = UUID().uuidString
                            Task { await acquire() }
                        }
                    }
                }
                Section("设备") {
                    ForEach(snapshot.devices) { device in
                        DeviceRow(device: device, lease: snapshot.leases.first { $0.devices.contains(device.id) }, owners: snapshot.owners) {
                            Task { await capture(device.id) }
                        }
                    }
                }
                if !snapshot.queue.isEmpty {
                    Section("排队") {
                        ForEach(snapshot.queue) { item in
                            VStack(alignment: .leading) {
                                Text(item.reason)
                                Text("\(item.platforms.joined(separator: " + ")) · \(item.phase)").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Section("最近的操作") {
                    ForEach(Array(snapshot.events.suffix(30).reversed().enumerated()), id: \.offset) { _, event in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.text).font(.footnote)
                            Text(Date(timeIntervalSince1970: event.time / 1000), format: .dateTime.hour().minute().second()).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            if let error { Text(error).foregroundStyle(.red) }
        }
        .overlay { if snapshot == nil && error == nil { ProgressView() } }
        .navigationTitle("设备")
        .sheet(isPresented: Binding(get: { screenshot != nil }, set: { if !$0 { screenshot = nil } })) {
            if let screenshot {
                Image(uiImage: screenshot.image).resizable().scaledToFit().padding().presentationDetents([.large])
            }
        }
        .task(id: hub.devices) { await load() }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                await load()
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                if manualWaiting != nil || (manualLease != nil && manualLease?.claimed != true) { await acquire() }
            }
        }
    }

    private func load() async {
        do {
            snapshot = try await API.shared.get("/api/apps/devices")
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func acquire() async {
        struct Body: Encodable {
            let platforms: [String]
            let reason: String
            let requestId: String
        }
        let platforms = platform == "both" ? ["android", "ios"] : [platform]
        await post("/leases", body: Body(platforms: platforms, reason: reason, requestId: requestId))
    }

    private func post(_ path: String, body: (any Encodable)? = nil) async {
        do {
            try await API.shared.post("/api/apps/devices\(path)", body: body)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        await load()
    }

    private func capture(_ id: String) async {
        struct Shot: Decodable { let image: String }
        do {
            let shot: Shot = try await API.shared.get("/api/apps/devices/\(id)/screenshot")
            if let data = Data(base64Encoded: shot.image), let image = UIImage(data: data) { screenshot = (id, image) }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct DeviceRow: View {
    let device: DevicesSnapshot.Device
    let lease: DevicesSnapshot.Lease?
    let owners: [String: DevicesSnapshot.Owner]
    let onScreenshot: () -> Void

    private static let statusNames = ["creating": "初始化中", "checking": "检查中", "free": "闲置", "reserved": "整组预留", "leased": "使用中", "cleaning": "清理中", "destroying": "回收中", "broken": "故障隔离"]

    var body: some View {
        HStack {
            Image(systemName: device.platform == "ios" ? "iphone" : "candybarphone")
                .foregroundStyle(device.status == "free" ? .green : device.status == "broken" ? .red : .orange)
            VStack(alignment: .leading, spacing: 2) {
                Text(device.name)
                Text([Self.statusNames[device.status] ?? device.status, device.system].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let lease {
                    Text(lease.owner == "manual" ? "手动使用" : owners[lease.owner].map { "对话：\($0.title)" } ?? lease.reason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if let error = device.error { Text(error).font(.caption).foregroundStyle(.red) }
            }
            Spacer()
            if ["free", "reserved", "leased"].contains(device.status), device.error == nil {
                Button("截图", systemImage: "camera", action: onScreenshot).labelStyle(.iconOnly).buttonStyle(.borderless)
            }
        }
    }
}
