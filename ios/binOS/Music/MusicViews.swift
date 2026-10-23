import SwiftUI

// 音乐：搜索或粘贴链接加入共享队列，本机播放；也可以遥控别的设备上的播放器
struct MusicRootView: View {
    private let player = MusicPlayer.shared
    @State private var providers: [ProviderInfo] = []
    @State private var provider = "youtube-music"
    @State private var query = ""
    @State private var results: CatalogPage?
    @State private var searching = false
    @State private var error: String?
    @Bindable private var router = AppRouter.shared
    @State private var others: [PlayerSnapshot] = []

    var body: some View {
        NavigationStack {
            List {
                if !query.trimmingCharacters(in: .whitespaces).isEmpty {
                    searchResults
                } else {
                    if let track = player.current {
                        Section {
                            Button { router.nowPlaying = true } label: {
                                NowPlayingSummary(track: track)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    queueSection
                    if !others.isEmpty {
                        Section("其他播放器") {
                            ForEach(others) { RemotePlayerRow(snapshot: $0, queue: player.queue) }
                        }
                    }
                }
            }
            .navigationTitle("音乐")
            .searchable(text: $query, prompt: "搜索，或粘贴 YouTube 链接")
            .onSubmit(of: .search) { Task { await search() } }
            .onChange(of: query) { results = nil }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Picker("来源", selection: $provider) {
                            ForEach(providers) { Text($0.name).tag($0.id) }
                        }
                        if !player.queue.isEmpty {
                            Button("清空队列", systemImage: "trash", role: .destructive) {
                                Task { try? await player.clear() }
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                    }
                }
            }
            .refreshable {
                await player.refreshQueue()
                await loadOthers()
            }
            .sheet(isPresented: $router.nowPlaying) { NowPlayingView() }
            .task { providers = (try? await MusicAPI.providers()) ?? [] }
            .task {
                while !Task.isCancelled {
                    await loadOthers()
                    try? await Task.sleep(for: .seconds(5))
                }
            }
        }
    }

    private func loadOthers() async {
        if let players = try? await MusicAPI.players() {
            others = players.filter { $0.id != player.playerId }
        }
    }

    private var queueSection: some View {
        Section {
            if player.queue.isEmpty {
                Text("队列是空的，搜索歌曲加入队列").foregroundStyle(.secondary)
            }
            ForEach(Array(player.queue.enumerated()), id: \.element.id) { offset, track in
                Button {
                    player.select(offset)
                } label: {
                    TrackRow(track: track, playing: offset == player.index && player.status != .idle)
                }
                .buttonStyle(.plain)
                .swipeActions {
                    Button("移除", systemImage: "trash", role: .destructive) {
                        Task { try? await player.remove(track) }
                    }
                }
                .contextMenu {
                    if let url = URL(string: track.externalUrl) {
                        Link(destination: url) { Label("在 YouTube 打开", systemImage: "safari") }
                    }
                    Button("移除", systemImage: "trash", role: .destructive) {
                        Task { try? await player.remove(track) }
                    }
                }
            }
        } header: {
            Text("共享队列 · \(player.queue.count) 首")
        }
    }

    @ViewBuilder
    private var searchResults: some View {
        if searching {
            HStack { Spacer(); ProgressView(); Spacer() }
        } else if let error {
            Text(error).foregroundStyle(.red)
        } else if let results {
            if let warning = results.warning {
                Text(warning).font(.footnote).foregroundStyle(.orange)
            }
            Section {
                if results.tracks.count > 1 {
                    Button("全部加入队列", systemImage: "text.badge.plus") {
                        Task { try? await player.add(results.tracks) }
                    }
                }
                ForEach(results.tracks) { track in
                    HStack {
                        TrackRow(track: track, playing: false)
                        Menu {
                            Button("播放", systemImage: "play.fill") { Task { try? await player.playNow(track) } }
                            Button("加入队列", systemImage: "text.badge.plus") { Task { try? await player.add([track]) } }
                        } label: {
                            Image(systemName: player.queue.contains { $0.ref == track.ref } ? "checkmark.circle.fill" : "plus.circle")
                                .font(.title3)
                        }
                    }
                }
                if let next = results.nextPage {
                    Button("更多结果") { Task { await search(page: next) } }
                }
            }
        } else {
            Text("按搜索键开始").foregroundStyle(.secondary)
        }
    }

    private func search(page: String? = nil) async {
        let text = query.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        let info = providers.first { $0.id == provider }
        let operation = info?.operation(for: text) ?? "search"
        if page == nil { searching = true }
        error = nil
        defer { searching = false }
        do {
            let loaded = try await MusicAPI.catalog(provider: provider, operation: operation, query: text, page: page)
            // 翻页时接在已有的结果后面
            if page != nil, let previous = results {
                results = CatalogPage(tracks: previous.tracks + loaded.tracks, nextPage: loaded.nextPage, warning: loaded.warning)
            } else {
                results = loaded
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct Artwork: View {
    let url: String?
    var size: CGFloat = 44

    var body: some View {
        AsyncImage(url: url.flatMap(URL.init(string:))) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Image(systemName: "music.note")
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.quaternary)
        }
        .frame(width: size, height: size)
        .clipShape(.rect(cornerRadius: size / 8))
    }
}

private struct TrackRow: View {
    let track: Track
    let playing: Bool

    var body: some View {
        HStack(spacing: 12) {
            Artwork(url: track.artworkUrl)
            VStack(alignment: .leading, spacing: 2) {
                Text(track.title).lineLimit(1).foregroundStyle(playing ? AnyShapeStyle(.tint) : AnyShapeStyle(.primary))
                Text(track.artistText).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            if playing {
                Image(systemName: "waveform").symbolEffect(.variableColor.iterative, isActive: MusicPlayer.shared.status == .playing).foregroundStyle(.tint)
            } else if let ms = track.durationMs {
                Text(Duration.seconds(ms / 1000).formatted(.time(pattern: .minuteSecond))).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
        }
        .contentShape(.rect)
    }
}

private struct NowPlayingSummary: View {
    let track: Track
    private let player = MusicPlayer.shared

    var body: some View {
        HStack(spacing: 14) {
            Artwork(url: track.artworkUrl, size: 64)
            VStack(alignment: .leading, spacing: 4) {
                Text(track.title).font(.headline).lineLimit(2)
                Text(track.artistText).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                if let error = player.error, player.status == .error {
                    Text(error).font(.caption).foregroundStyle(.red).lineLimit(2)
                }
            }
            Spacer()
            PlayPauseButton().font(.title)
        }
    }
}

struct PlayPauseButton: View {
    private let player = MusicPlayer.shared

    var body: some View {
        Button {
            player.toggle()
        } label: {
            if player.status == .loading {
                ProgressView()
            } else {
                Image(systemName: player.status == .playing ? "pause.fill" : "play.fill")
                    .contentTransition(.symbolEffect(.replace))
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(player.status == .playing ? "暂停" : "播放")
    }
}

// 底部标签栏上方的迷你播放器
struct MiniPlayer: View {
    let onOpen: () -> Void
    private let player = MusicPlayer.shared
    @State private var showingNowPlaying = false

    var body: some View {
        HStack(spacing: 10) {
            if let track = player.current {
                Artwork(url: track.artworkUrl, size: 30)
                VStack(alignment: .leading, spacing: 0) {
                    Text(track.title).font(.footnote.weight(.semibold)).lineLimit(1)
                    Text(track.artistText).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                PlayPauseButton()
                Button { player.next() } label: { Image(systemName: "forward.fill") }
                    .buttonStyle(.plain)
                    .accessibilityLabel("下一首")
            }
        }
        .padding(.horizontal, 14)
        .contentShape(.rect)
        .onTapGesture { showingNowPlaying = true }
        .sheet(isPresented: $showingNowPlaying) { NowPlayingView() }
    }
}

struct NowPlayingView: View {
    @Bindable private var player = MusicPlayer.shared
    @State private var scrubbing: Double?
    @State private var lyrics: Lyrics?
    @State private var showingLyrics = false

    var body: some View {
        VStack(spacing: 24) {
            Capsule().fill(.tertiary).frame(width: 40, height: 5).padding(.top, 8)
            if let track = player.current {
                if showingLyrics {
                    ScrollView {
                        Text(lyrics?.text ?? "没有歌词")
                            .font(.title3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if let attribution = lyrics?.attribution {
                            Text(attribution).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxHeight: .infinity)
                } else {
                    Artwork(url: track.artworkUrl, size: 300)
                        .shadow(radius: 20, y: 10)
                        .frame(maxHeight: .infinity)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(track.title).font(.title2.bold()).lineLimit(2)
                    Text(track.artistText).font(.title3).foregroundStyle(.secondary).lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(spacing: 4) {
                    Slider(value: Binding(get: { scrubbing ?? player.position }, set: { scrubbing = $0 }), in: 0...max(player.duration, 1)) { editing in
                        if !editing, let scrubbing {
                            player.seek(to: scrubbing)
                            self.scrubbing = nil
                        }
                    }
                    HStack {
                        Text(Duration.seconds(scrubbing ?? player.position).formatted(.time(pattern: .minuteSecond)))
                        Spacer()
                        Text(Duration.seconds(player.duration).formatted(.time(pattern: .minuteSecond)))
                    }
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                }
                if let error = player.error, player.status == .error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                HStack(spacing: 44) {
                    Button { player.previous() } label: { Image(systemName: "backward.fill") }
                    PlayPauseButton().font(.system(size: 44))
                    Button { player.next() } label: { Image(systemName: "forward.fill") }
                }
                .font(.title)
                .buttonStyle(.plain)
                HStack(spacing: 12) {
                    Image(systemName: "speaker.fill").foregroundStyle(.secondary)
                    Slider(value: $player.volume, in: 0...1)
                    Image(systemName: "speaker.wave.3.fill").foregroundStyle(.secondary)
                }
                HStack {
                    Button {
                        showingLyrics.toggle()
                    } label: {
                        Image(systemName: "quote.bubble").foregroundStyle(showingLyrics ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                    }
                    Spacer()
                    Picker("循环", selection: $player.repeatMode) {
                        Label("不循环", systemImage: "repeat").tag(RepeatMode.off)
                        Label("全部循环", systemImage: "repeat").tag(RepeatMode.all)
                        Label("单曲循环", systemImage: "repeat.1").tag(RepeatMode.one)
                    }
                    .pickerStyle(.menu)
                }
                .font(.title3)
            } else {
                ContentUnavailableView("没有在播放", systemImage: "music.note")
            }
        }
        .padding(.horizontal, 28)
        .padding(.bottom)
        .presentationDragIndicator(.hidden)
        .task(id: "\(player.current?.ref.id ?? "")-\(showingLyrics)") {
            guard showingLyrics, let ref = player.current?.ref else { return }
            lyrics = try? await MusicAPI.lyrics(ref)
        }
    }
}

// 别的设备上的播放器：看它在放什么，遥控它
private struct RemotePlayerRow: View {
    let snapshot: PlayerSnapshot
    let queue: [Track]
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: snapshot.label.contains("iOS") || snapshot.label.contains("Android") ? "iphone" : "laptopcomputer")
                Text(snapshot.label).font(.headline)
                Spacer()
                if let state = snapshot.state {
                    Text(statusName(state.status)).font(.caption).foregroundStyle(.secondary)
                }
            }
            if let ref = snapshot.state?.track, let track = queue.first(where: { $0.ref == ref }) {
                Text("\(track.title) · \(track.artistText)").font(.footnote).lineLimit(1)
            }
            HStack(spacing: 28) {
                control(.previous, "backward.fill")
                control(snapshot.state?.status == .playing ? .pause : .play, snapshot.state?.status == .playing ? "pause.fill" : "play.fill")
                control(.next, "forward.fill")
                control(.stop, "stop.fill")
            }
            .buttonStyle(.borderless)
            if let error {
                Text(error).font(.caption).foregroundStyle(.red)
            }
        }
    }

    private func control(_ command: PlayerCommand, _ icon: String) -> some View {
        Button {
            Task {
                do {
                    try await MusicAPI.command(player: snapshot.id, command)
                    error = nil
                } catch {
                    self.error = error.localizedDescription
                }
            }
        } label: {
            Image(systemName: icon)
        }
        .disabled(snapshot.state == nil)
    }

    private func statusName(_ status: PlaybackStatus) -> String {
        switch status {
        case .idle: "空闲"
        case .loading: "加载中"
        case .playing: "播放中"
        case .paused: "已暂停"
        case .ended: "已放完"
        case .error: "出错"
        }
    }
}
