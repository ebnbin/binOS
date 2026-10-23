import Foundation
import Observation

enum MoreRoute: Hashable {
    case system, accounts, browser, calendar, builds, devices, settings
}

// 整个 app 的导航状态，深链接 binos://… 也走这里：
// binos://code/<id>、binos://code/new、binos://terminal/<会话 id>、binos://music/now、binos://files?path=…、binos://more/<页面>
@Observable
final class AppRouter {
    static let shared = AppRouter()

    var tab = AppTab.code
    var code: CodeRoute?
    var terminal: String?
    var files: String?
    var nowPlaying = false
    var more: [MoreRoute] = []

    private init() {}

    func open(_ url: URL) {
        guard url.scheme == "binos" else { return }
        let parts = url.pathComponents.filter { $0 != "/" }
        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        switch url.host() {
        case "code":
            tab = .code
            if parts.first == "new" {
                code = .new(project: query.first { $0.name == "project" }?.value ?? "binos")
            } else if let id = parts.first.flatMap(Int.init) {
                code = .session(id, item: query.first { $0.name == "item" }?.value.flatMap(Int.init))
            } else if parts.first == "builds" {
                code = .builds
            } else if parts.first == "devices" {
                code = .devices
            } else {
                code = nil
            }
        case "terminal":
            tab = .terminal
            terminal = parts.first
        case "music":
            tab = .music
            nowPlaying = parts.first == "now"
        case "files":
            tab = .files
            files = query.first { $0.name == "path" }?.value
        case "more":
            tab = .more
            let routes: [String: MoreRoute] = ["system": .system, "accounts": .accounts, "browser": .browser, "calendar": .calendar, "builds": .builds, "devices": .devices, "settings": .settings]
            more = parts.first.flatMap { routes[$0] }.map { [$0] } ?? []
        default:
            break
        }
    }
}
