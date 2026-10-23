import SwiftUI

// 手机上放不下的 app 收在这里
struct MoreView: View {
    @Bindable private var router = AppRouter.shared

    var body: some View {
        NavigationStack(path: $router.more) {
            List {
                Section {
                    NavigationLink(value: MoreRoute.system) { Label("系统", systemImage: "gauge.with.dots.needle.67percent") }
                    NavigationLink(value: MoreRoute.accounts) { Label("Agent 账号", systemImage: "person.crop.circle.badge.checkmark") }
                    NavigationLink(value: MoreRoute.browser) { Label("浏览器", systemImage: "safari") }
                    NavigationLink(value: MoreRoute.calendar) { Label("日历", systemImage: "calendar") }
                }
                Section {
                    NavigationLink(value: MoreRoute.builds) { Label("构建", systemImage: "hammer") }
                    NavigationLink(value: MoreRoute.devices) { Label("设备", systemImage: "iphone.gen3") }
                }
                ExternalAppsSection()
                Section {
                    NavigationLink(value: MoreRoute.settings) { Label("连接", systemImage: "network") }
                }
            }
            .navigationTitle("更多")
            .navigationDestination(for: MoreRoute.self) { route in
                switch route {
                case .system: SystemView()
                case .accounts: AgentAccountsView()
                case .browser: BrowserView()
                case .calendar: CalendarView()
                case .builds: BuildsView()
                case .devices: DevicesView()
                case .settings: SettingsView()
                }
            }
        }
    }
}
