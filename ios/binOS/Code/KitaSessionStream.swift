import Foundation
import Observation

// 一个 thread 的内容，随推送更新：条目按序号接着补发，live 是回答进行中的临时内容，nil 表示没在回答
@Observable
final class KitaSessionStream {
    private(set) var items: [Entry] = []
    private(set) var live: Live?
    // 条目或回答状态变了才加一，界面据此重算对话的分块；临时文字的变化不影响它
    private(set) var revision = 0
    private(set) var loaded = false

    let thread: String
    private var stream: EventStream?

    init(thread: String) {
        self.thread = thread
    }

    func start() {
        guard stream == nil else { return }
        // 断线重连时从已收到的条数接着补发
        let stream = EventStream(
            url: { [weak self] in
                API.shared.url("/api/kita/sessions/\(self?.thread ?? "")/stream", query: ["from": String(self?.items.count ?? 0)])
            },
            onMessage: { [weak self] message in self?.receive(message) }
        )
        self.stream = stream
        stream.start()
    }

    func stop() {
        stream?.stop()
        stream = nil
    }

    func reconnectIfStale() {
        stream?.reconnectIfStale()
    }

    private func receive(_ message: SSEMessage) {
        guard let event = try? JSONDecoder.api.decode(KitaSessionEvent.self, from: Data(message.data.utf8)) else { return }
        switch event {
        case .event(let seq, let entry):
            guard seq == items.count + 1 else { return }
            items.append(entry)
            // 记成条目的思考和文字取代对应的临时内容
            if var current = live, entry.parent == nil {
                switch entry {
                case .text:
                    current.text = ""
                    current.files = [:]
                    live = current
                case .thinking:
                    current.thinking = ""
                    live = current
                default: break
                }
            }
            revision += 1
        case .live(let value):
            let toggled = (live == nil) != (value == nil)
            live = value
            loaded = true
            if toggled { revision += 1 }
        case .thinking(let text):
            live?.thinking += text
        case .text(let text):
            live?.text += text
        case .status(let status):
            live?.status = status
        case .task(let callId, let progress):
            live?.tasks[callId] = progress
        case .file(let path, let name):
            live?.files[path] = name
        case .unknown:
            break
        }
    }

    var agent: String? {
        if case .session(let agent, _) = items.first { return agent }
        return nil
    }
}
