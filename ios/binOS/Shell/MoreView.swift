import SwiftUI

// 手机上放不下的 app 收在这里
struct MoreView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink { SystemView() } label: { Label("系统", systemImage: "gauge.with.dots.needle.67percent") }
                    NavigationLink { AgentAccountsView() } label: { Label("Agent 账号", systemImage: "person.crop.circle.badge.checkmark") }
                    NavigationLink { BrowserView() } label: { Label("浏览器", systemImage: "safari") }
                    NavigationLink { CalendarView() } label: { Label("日历", systemImage: "calendar") }
                }
                Section {
                    NavigationLink { BuildsView() } label: { Label("构建", systemImage: "hammer") }
                    NavigationLink { DevicesView() } label: { Label("设备", systemImage: "iphone.gen3") }
                }
                ExternalAppsSection()
                Section {
                    NavigationLink { SettingsView() } label: { Label("连接", systemImage: "network") }
                }
            }
            .navigationTitle("更多")
        }
    }
}
