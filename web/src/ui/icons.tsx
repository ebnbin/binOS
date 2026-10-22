import type { ComponentType, ComponentProps } from 'react'
import {
  ActivityLogIcon as ActivityGlyph,
  OpenInNewWindowIcon as AppWindowGlyph,
  ArchiveIcon as ArchiveGlyph,
  ResetIcon as ArchiveRestoreGlyph,
  ArrowDownIcon as ArrowDownGlyph,
  ArrowLeftIcon as ArrowLeftGlyph,
  ArrowRightIcon as ArrowRightGlyph,
  ArrowUpIcon as ArrowUpGlyph,
  ArrowTopRightIcon as ArrowUpRightGlyph,
  ReaderIcon as BookOpenGlyph,
  MagicWandIcon as BotGlyph,
  BackpackIcon as BriefcaseGlyph,
  TableIcon as CalculatorGlyph,
  CalendarIcon as CalendarDaysGlyph,
  CameraIcon as CameraGlyph,
  BarChartIcon as ChartLineGlyph,
  CheckIcon as CheckGlyph,
  ChevronDownIcon as ChevronDownGlyph,
  ChevronLeftIcon as ChevronLeftGlyph,
  ChevronRightIcon as ChevronRightGlyph,
  ExclamationTriangleIcon as CircleAlertGlyph,
  StopIcon as CircleStopGlyph,
  ClockIcon as ClockGlyph,
  GlobeIcon as CloudGlyph,
  CodeIcon as CodeGlyph,
  CodeIcon as CodeXmlGlyph,
  CopyIcon as CopyGlyph,
  Component1Icon as CpuGlyph,
  StackIcon as DatabaseGlyph,
  DiscIcon as Disc3Glyph,
  DownloadIcon as DownloadGlyph,
  ActivityLogIcon as DumbbellGlyph,
  EnterFullScreenIcon as ExpandGlyph,
  ExternalLinkIcon as ExternalLinkGlyph,
  FileIcon as FileGlyph,
  FileTextIcon as FileDiffGlyph,
  Pencil2Icon as FilePenGlyph,
  FilePlusIcon as FilePlusGlyph,
  FileTextIcon as FileTextGlyph,
  VideoIcon as FilmGlyph,
  ArchiveIcon as FolderGlyph,
  ButtonIcon as Gamepad2Glyph,
  DashboardIcon as GaugeGlyph,
  MixIcon as GitMergeGlyph,
  Share1Icon as GitPullRequestGlyph,
  LinkBreak1Icon as GitPullRequestClosedGlyph,
  GlobeIcon as GlobeGlyph,
  ReaderIcon as GraduationCapGlyph,
  RulerSquareIcon as HammerGlyph,
  BoxIcon as HardDriveGlyph,
  HeartIcon as HeartGlyph,
  HomeIcon as HomeGlyph,
  CountdownTimerIcon as HourglassGlyph,
  HomeIcon as HouseGlyph,
  ImageIcon as ImageGlyph,
  EyeNoneIcon as ImageOffGlyph,
  InfoCircledIcon as InfoGlyph,
  ViewGridIcon as LayoutGridGlyph,
  SymbolIcon as LeafGlyph,
  RowsIcon as ListGlyph,
  ListBulletIcon as ListMusicGlyph,
  CardStackPlusIcon as ListPlusGlyph,
  CheckboxIcon as ListTodoGlyph,
  UpdateIcon as LoaderCircleGlyph,
  LockClosedIcon as LockGlyph,
  EnvelopeClosedIcon as MailGlyph,
  GlobeIcon as MapGlyph,
  ValueIcon as MemoryStickGlyph,
  ChatBubbleIcon as MessageCircleGlyph,
  ChatBubbleIcon as MessageSquareGlyph,
  DesktopIcon as MonitorGlyph,
  DotsHorizontalIcon as MoreHorizontalGlyph,
  DiscIcon as MusicGlyph,
  DiscIcon as Music2Glyph,
  Share2Icon as NetworkGlyph,
  ReaderIcon as NewspaperGlyph,
  MagnifyingGlassIcon as PackageSearchGlyph,
  Link2Icon as PaperclipGlyph,
  PauseIcon as PauseGlyph,
  Pencil1Icon as PencilGlyph,
  DrawingPinFilledIcon as PinGlyph,
  DrawingPinIcon as PinOffGlyph,
  PaperPlaneIcon as PlaneGlyph,
  PlayIcon as PlayGlyph,
  LightningBoltIcon as PlugZapGlyph,
  PlusIcon as PlusGlyph,
  Component2Icon as PuzzleGlyph,
  ReloadIcon as RefreshCwGlyph,
  LoopIcon as RepeatGlyph,
  LoopIcon as Repeat1Glyph,
  ReloadIcon as RotateCwGlyph,
  MagnifyingGlassIcon as SearchGlyph,
  MixerHorizontalIcon as Settings2Glyph,
  BackpackIcon as ShoppingCartGlyph,
  TrackPreviousIcon as SkipBackGlyph,
  TrackNextIcon as SkipForwardGlyph,
  MobileIcon as SmartphoneGlyph,
  MagicWandIcon as SparklesGlyph,
  Pencil2Icon as SquarePenGlyph,
  CodeIcon as SquareTerminalGlyph,
  StarIcon as StarGlyph,
  Crosshair2Icon as SwordsGlyph,
  CodeIcon as TerminalGlyph,
  UploadIcon as UploadGlyph,
  PersonIcon as UserRoundGlyph,
  MixIcon as UtensilsGlyph,
  SpeakerLoudIcon as Volume2Glyph,
  SpeakerOffIcon as VolumeXGlyph,
  IdCardIcon as WalletGlyph,
  GearIcon as WrenchGlyph,
  Cross2Icon as XGlyph,
  LightningBoltIcon as ZapGlyph,
} from '@radix-ui/react-icons'

export type IconProps = ComponentProps<typeof ActivityGlyph> & { size?: number | string }
export type SystemIcon = ComponentType<IconProps>

function icon(Glyph: ComponentType<ComponentProps<typeof ActivityGlyph>>): SystemIcon {
  return ({ size = 20, strokeWidth: _strokeWidth, ...props }: IconProps) => (
    <Glyph width={size} height={size} aria-hidden="true" focusable="false" {...props} />
  )
}

export const Activity = icon(ActivityGlyph)
export const AppWindow = icon(AppWindowGlyph)
export const Archive = icon(ArchiveGlyph)
export const ArchiveRestore = icon(ArchiveRestoreGlyph)
export const ArrowDown = icon(ArrowDownGlyph)
export const ArrowLeft = icon(ArrowLeftGlyph)
export const ArrowRight = icon(ArrowRightGlyph)
export const ArrowUp = icon(ArrowUpGlyph)
export const ArrowUpRight = icon(ArrowUpRightGlyph)
export const BookOpen = icon(BookOpenGlyph)
export const Bot = icon(BotGlyph)
export const Briefcase = icon(BriefcaseGlyph)
export const Calculator = icon(CalculatorGlyph)
export const CalendarDays = icon(CalendarDaysGlyph)
export const Camera = icon(CameraGlyph)
export const ChartLine = icon(ChartLineGlyph)
export const Check = icon(CheckGlyph)
export const ChevronDown = icon(ChevronDownGlyph)
export const ChevronLeft = icon(ChevronLeftGlyph)
export const ChevronRight = icon(ChevronRightGlyph)
export const CircleAlert = icon(CircleAlertGlyph)
export const CircleStop = icon(CircleStopGlyph)
export const Clock = icon(ClockGlyph)
export const Cloud = icon(CloudGlyph)
export const Code = icon(CodeGlyph)
export const CodeXml = icon(CodeXmlGlyph)
export const Copy = icon(CopyGlyph)
export const Cpu = icon(CpuGlyph)
export const Database = icon(DatabaseGlyph)
export const Disc3 = icon(Disc3Glyph)
export const Download = icon(DownloadGlyph)
export const Dumbbell = icon(DumbbellGlyph)
export const Expand = icon(ExpandGlyph)
export const ExternalLink = icon(ExternalLinkGlyph)
export const File = icon(FileGlyph)
export const FileDiff = icon(FileDiffGlyph)
export const FilePen = icon(FilePenGlyph)
export const FilePlus = icon(FilePlusGlyph)
export const FileText = icon(FileTextGlyph)
export const Film = icon(FilmGlyph)
export const Folder = icon(FolderGlyph)
export const Gamepad2 = icon(Gamepad2Glyph)
export const Gauge = icon(GaugeGlyph)
export const GitMerge = icon(GitMergeGlyph)
export const GitPullRequest = icon(GitPullRequestGlyph)
export const GitPullRequestClosed = icon(GitPullRequestClosedGlyph)
export const Globe = icon(GlobeGlyph)
export const GraduationCap = icon(GraduationCapGlyph)
export const Hammer = icon(HammerGlyph)
export const HardDrive = icon(HardDriveGlyph)
export const Heart = icon(HeartGlyph)
export const Home = icon(HomeGlyph)
export const Hourglass = icon(HourglassGlyph)
export const House = icon(HouseGlyph)
export const Image = icon(ImageGlyph)
export const ImageOff = icon(ImageOffGlyph)
export const Info = icon(InfoGlyph)
export const LayoutGrid = icon(LayoutGridGlyph)
export const Leaf = icon(LeafGlyph)
export const List = icon(ListGlyph)
export const ListMusic = icon(ListMusicGlyph)
export const ListPlus = icon(ListPlusGlyph)
export const ListTodo = icon(ListTodoGlyph)
export const LoaderCircle = icon(LoaderCircleGlyph)
export const Lock = icon(LockGlyph)
export const Mail = icon(MailGlyph)
export const Map = icon(MapGlyph)
export const MemoryStick = icon(MemoryStickGlyph)
export const MessageCircle = icon(MessageCircleGlyph)
export const MessageSquare = icon(MessageSquareGlyph)
export const Monitor = icon(MonitorGlyph)
export const MoreHorizontal = icon(MoreHorizontalGlyph)
export const Music = icon(MusicGlyph)
export const Music2 = icon(Music2Glyph)
export const Network = icon(NetworkGlyph)
export const Newspaper = icon(NewspaperGlyph)
export const PackageSearch = icon(PackageSearchGlyph)
export const Paperclip = icon(PaperclipGlyph)
export const Pause = icon(PauseGlyph)
export const Pencil = icon(PencilGlyph)
export const Pin = icon(PinGlyph)
export const PinOff = icon(PinOffGlyph)
export const Plane = icon(PlaneGlyph)
export const Play = icon(PlayGlyph)
export const PlugZap = icon(PlugZapGlyph)
export const Plus = icon(PlusGlyph)
export const Puzzle = icon(PuzzleGlyph)
export const RefreshCw = icon(RefreshCwGlyph)
export const Repeat = icon(RepeatGlyph)
export const Repeat1 = icon(Repeat1Glyph)
export const RotateCw = icon(RotateCwGlyph)
export const Search = icon(SearchGlyph)
export const Settings2 = icon(Settings2Glyph)
export const ShoppingCart = icon(ShoppingCartGlyph)
export const SkipBack = icon(SkipBackGlyph)
export const SkipForward = icon(SkipForwardGlyph)
export const Smartphone = icon(SmartphoneGlyph)
export const Sparkles = icon(SparklesGlyph)
export const SquarePen = icon(SquarePenGlyph)
export const SquareTerminal = icon(SquareTerminalGlyph)
export const Star = icon(StarGlyph)
export const Swords = icon(SwordsGlyph)
export const Terminal = icon(TerminalGlyph)
export const Upload = icon(UploadGlyph)
export const UserRound = icon(UserRoundGlyph)
export const Utensils = icon(UtensilsGlyph)
export const Volume2 = icon(Volume2Glyph)
export const VolumeX = icon(VolumeXGlyph)
export const Wallet = icon(WalletGlyph)
export const Wrench = icon(WrenchGlyph)
export const X = icon(XGlyph)
export const Zap = icon(ZapGlyph)
