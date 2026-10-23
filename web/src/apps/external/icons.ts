import { BookIcon, BriefcaseIcon, BrowserIcon, CloudIcon, CodeIcon, CommentIcon, CreditCardIcon, DatabaseIcon, DeviceCameraIcon, DiceIcon, FlameIcon, GlobeIcon, GraphIcon, HeartIcon, HomeIcon, ImageIcon, LocationIcon, LockIcon, MailIcon, MortarBoardIcon, NumberIcon, PackageIcon, PaperAirplaneIcon, RssIcon, ShieldIcon, SquirrelIcon, StarIcon, TagIcon, TerminalIcon, UnmuteIcon, VideoIcon } from '@primer/octicons-react'
import type { Icon } from '@primer/octicons-react'

// 外部 app 可选的图标，清单里存键名
export const icons = {
  'app-window': BrowserIcon,
  globe: GlobeIcon,
  puzzle: PackageIcon,
  swords: ShieldIcon,
  'gamepad-2': DiceIcon,
  'book-open': BookIcon,
  newspaper: RssIcon,
  'graduation-cap': MortarBoardIcon,
  briefcase: BriefcaseIcon,
  'chart-line': GraphIcon,
  wallet: CreditCardIcon,
  calculator: NumberIcon,
  'shopping-cart': TagIcon,
  mail: MailIcon,
  'message-circle': CommentIcon,
  camera: DeviceCameraIcon,
  image: ImageIcon,
  film: VideoIcon,
  music: UnmuteIcon,
  code: CodeIcon,
  terminal: TerminalIcon,
  database: DatabaseIcon,
  cloud: CloudIcon,
  lock: LockIcon,
  house: HomeIcon,
  map: LocationIcon,
  plane: PaperAirplaneIcon,
  utensils: FlameIcon,
  dumbbell: FlameIcon,
  leaf: SquirrelIcon,
  heart: HeartIcon,
  star: StarIcon,
} satisfies Record<string, Icon>

export type IconName = keyof typeof icons

export const iconNames = Object.keys(icons) as IconName[]
