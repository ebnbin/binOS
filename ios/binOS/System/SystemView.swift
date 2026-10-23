import SwiftUI

struct MonitorStatus: Decodable {
    struct Volume: Decodable, Hashable {
        let filesystem: String
        let mount: String
        let total: Double
        let available: Double
        let used: Double
    }

    struct Snapshot: Decodable {
        struct Host: Decodable {
            let name: String
            let model: String
            let chip: String
            let os: String
            let uptime: Double
            let cores: Int
        }

        struct CPU: Decodable { let percent: Double? }

        struct Memory: Decodable {
            let total: Double
            let free: Double
            let cached: Double?
            let pressure: String
        }

        struct Network: Decodable {
            let receiveRate: Double?
            let sendRate: Double?
        }

        struct Power: Decodable {
            let source: String
            let battery: Double?
        }

        struct Runtime: Decodable {
            let version: String
            let uptime: Double
            let memory: Double
            let test: Bool
        }

        let at: Double
        let host: Host
        let cpu: CPU
        let memory: Memory
        let volumes: [Volume]
        let network: Network
        let power: Power
        let runtime: Runtime
        let unavailable: [String]
    }

    let snapshot: Snapshot?
    let collecting: Bool
    let collectionError: String?
}

// 系统：宿主 Mac 的状态，每 5 秒更新
struct SystemView: View {
    @State private var status: MonitorStatus?
    @State private var error: String?
    @State private var refreshing = false
    private let hub = EventHub.shared

    var body: some View {
        List {
            if let snapshot = status?.snapshot {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(snapshot.host.name).font(.title2.bold())
                        Text("\(snapshot.host.chip) · \(snapshot.host.cores) 核 · \(snapshot.host.os)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    if !snapshot.unavailable.isEmpty {
                        Label("读不到：\(snapshot.unavailable.joined(separator: "、"))", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                            .font(.footnote)
                    }
                } footer: {
                    Text(freshness(snapshot))
                }
                Section("运行状况") {
                    Gauge(value: (snapshot.cpu.percent ?? 0) / 100) {
                        Label("CPU", systemImage: "cpu")
                    } currentValueLabel: {
                        Text(snapshot.cpu.percent.map { "\(Int($0))%" } ?? "采样中")
                    }
                    .gaugeStyle(.linearCapacity)
                    let memory = snapshot.memory
                    if let cached = memory.cached {
                        let used = max(0, memory.total - memory.free - cached)
                        Gauge(value: used / max(memory.total, 1)) {
                            Label("内存", systemImage: "memorychip")
                        } currentValueLabel: {
                            Text("\(Format.bytes(used)) / \(Format.bytes(memory.total))")
                        }
                        .gaugeStyle(.linearCapacity)
                        .tint(memory.pressure == "critical" ? .red : memory.pressure == "warning" ? .orange : .accentColor)
                    }
                    LabeledContent("内存压力", value: ["normal": "正常", "warning": "偏高", "critical": "很高"][memory.pressure] ?? "未知")
                    LabeledContent("网络") {
                        Text("↓ \(snapshot.network.receiveRate.map { Format.bytes($0) + "/s" } ?? "—")  ↑ \(snapshot.network.sendRate.map { Format.bytes($0) + "/s" } ?? "—")")
                            .monospacedDigit()
                    }
                    LabeledContent("电源") {
                        let source = snapshot.power.source == "AC Power" ? "外接电源" : snapshot.power.source == "Battery Power" ? "电池供电" : snapshot.power.source
                        Text(snapshot.power.battery.map { "\(source) · \(Int($0))%" } ?? source)
                    }
                    LabeledContent("已开机", value: uptime(snapshot.host.uptime))
                }
                Section("存储") {
                    ForEach(snapshot.volumes, id: \.mount) { volume in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(volume.mount == "/" || volume.mount == "/System/Volumes/Data" ? "启动磁盘" : (volume.mount as NSString).lastPathComponent)
                                Spacer()
                                Text("可用 \(Format.bytes(volume.available)) / \(Format.bytes(volume.total))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            ProgressView(value: (volume.total - volume.available) / max(volume.total, 1))
                        }
                    }
                }
                Section("binOS") {
                    LabeledContent("连接", value: hub.connected ? "已连接" : "连接已断开")
                    LabeledContent("版本", value: String(snapshot.runtime.version.prefix(7)))
                    LabeledContent("环境", value: snapshot.runtime.test ? "测试 / 预览" : "正式版")
                    LabeledContent("已运行", value: uptime(snapshot.runtime.uptime))
                    LabeledContent("内存", value: Format.bytes(snapshot.runtime.memory))
                }
            } else if let error {
                Text(error).foregroundStyle(.red)
            } else {
                HStack { Spacer(); ProgressView("首次采集中"); Spacer() }
            }
        }
        .navigationTitle("系统")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("刷新", systemImage: "arrow.clockwise") {
                    Task {
                        refreshing = true
                        if let result: MonitorStatus = try? await API.shared.send("POST", "/api/apps/system/refresh") { status = result }
                        refreshing = false
                    }
                }
                .disabled(refreshing)
            }
        }
        .task {
            while !Task.isCancelled {
                do {
                    status = try await API.shared.get("/api/apps/system/status")
                    error = nil
                } catch is CancellationError {
                } catch {
                    self.error = "监控连接异常：\(error.localizedDescription)"
                }
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    private func freshness(_ snapshot: MonitorStatus.Snapshot) -> String {
        let at = Date(timeIntervalSince1970: snapshot.at / 1000)
        let state = error != nil ? "监控连接异常" : Date.now.timeIntervalSince(at) > 30 ? "数据已过期" : status?.collectionError != nil ? "采集异常" : "正在监控"
        return "\(state) · \(at.formatted(date: .omitted, time: .standard))"
    }

    private func uptime(_ seconds: Double) -> String {
        let total = Int(seconds)
        let days = total / 86400, hours = total % 86400 / 3600, minutes = total % 3600 / 60
        return days > 0 ? "\(days) 天 \(hours) 小时" : hours > 0 ? "\(hours) 小时 \(minutes) 分" : "\(minutes) 分"
    }
}
