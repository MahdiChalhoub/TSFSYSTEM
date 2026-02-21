/**
 * Type declarations for lucide-react
 * The installed version (0.563.0) ships without .d.ts files.
 * This shim provides ambient types for LucideIcon components.
 */
declare module 'lucide-react' {
    import { FC, SVGProps } from 'react'

    export interface LucideProps extends SVGProps<SVGSVGElement> {
        size?: number | string
        color?: string
        strokeWidth?: number | string
        absoluteStrokeWidth?: boolean
        className?: string
    }

    export type LucideIcon = FC<LucideProps>

    // ─── Icons used across the project ──────────────────────────────
    // Navigation & Arrows
    export const ArrowLeft: LucideIcon
    export const ArrowRight: LucideIcon
    export const ArrowUp: LucideIcon
    export const ArrowDown: LucideIcon
    export const ArrowDownCircle: LucideIcon
    export const ArrowDownLeft: LucideIcon
    export const ArrowDownUp: LucideIcon
    export const ArrowLeftRight: LucideIcon
    export const ArrowRightCircle: LucideIcon
    export const ArrowRightLeft: LucideIcon
    export const ArrowUpCircle: LucideIcon
    export const ArrowUpDown: LucideIcon
    export const ArrowUpRight: LucideIcon
    export const ArrowDownRight: LucideIcon
    export const ChevronDown: LucideIcon
    export const ChevronLeft: LucideIcon
    export const ChevronRight: LucideIcon
    export const ChevronUp: LucideIcon
    export const ChevronsUpDown: LucideIcon
    export const ExternalLink: LucideIcon
    export const Forward: LucideIcon
    export const Navigation: LucideIcon

    // Actions
    export const Check: LucideIcon
    export const CheckCheck: LucideIcon
    export const CheckSquare: LucideIcon
    export const Copy: LucideIcon
    export const Download: LucideIcon
    export const Edit: LucideIcon
    export const Edit2: LucideIcon
    export const Edit3: LucideIcon
    export const Expand: LucideIcon
    export const Filter: LucideIcon
    export const Grip: LucideIcon
    export const GripVertical: LucideIcon
    export const Link: LucideIcon
    export const Link2: LucideIcon
    export const LogIn: LucideIcon
    export const LogOut: LucideIcon
    export const Maximize: LucideIcon
    export const Minimize: LucideIcon
    export const Minus: LucideIcon
    export const MoreHorizontal: LucideIcon
    export const MoreVertical: LucideIcon
    export const Paperclip: LucideIcon
    export const Pause: LucideIcon
    export const Pencil: LucideIcon
    export const Play: LucideIcon
    export const PlayCircle: LucideIcon
    export const Plus: LucideIcon
    export const PlusCircle: LucideIcon
    export const MinusCircle: LucideIcon
    export const RefreshCcw: LucideIcon
    export const RefreshCw: LucideIcon
    export const RotateCcw: LucideIcon
    export const RotateCw: LucideIcon
    export const Save: LucideIcon
    export const Search: LucideIcon
    export const Send: LucideIcon
    export const Shrink: LucideIcon
    export const Trash: LucideIcon
    export const Trash2: LucideIcon
    export const Undo2: LucideIcon
    export const Upload: LucideIcon
    export const UploadCloud: LucideIcon
    export const X: LucideIcon
    export const XCircle: LucideIcon
    export const XOctagon: LucideIcon

    // Status & Alerts
    export const Activity: LucideIcon
    export const AlertCircle: LucideIcon
    export const AlertTriangle: LucideIcon
    export const Ban: LucideIcon
    export const Bell: LucideIcon
    export const Bug: LucideIcon
    export const CheckCircle: LucideIcon
    export const CheckCircle2: LucideIcon
    export const HelpCircle: LucideIcon
    export const Info: LucideIcon
    export const Loader2: LucideIcon
    export const ShieldAlert: LucideIcon
    export const ShieldCheck: LucideIcon
    export const ShieldOff: LucideIcon
    export const ShieldX: LucideIcon
    export const Skull: LucideIcon

    // People & Auth
    export const Crown: LucideIcon
    export const Eye: LucideIcon
    export const EyeOff: LucideIcon
    export const Fingerprint: LucideIcon
    export const Key: LucideIcon
    export const KeyRound: LucideIcon
    export const Lock: LucideIcon
    export const Power: LucideIcon
    export const Shield: LucideIcon
    export const Unlock: LucideIcon
    export const User: LucideIcon
    export const UserCheck: LucideIcon
    export const UserCircle: LucideIcon
    export const UserCog: LucideIcon
    export const UserMinus: LucideIcon
    export const UserPlus: LucideIcon
    export const UserX: LucideIcon
    export const Users: LucideIcon
    export const Users2: LucideIcon

    // Business & Commerce
    export const Award: LucideIcon
    export const Banknote: LucideIcon
    export const Bookmark: LucideIcon
    export const Briefcase: LucideIcon
    export const Building: LucideIcon
    export const Building2: LucideIcon
    export const Calculator: LucideIcon
    export const Coins: LucideIcon
    export const CreditCard: LucideIcon
    export const DollarSign: LucideIcon
    export const Factory: LucideIcon
    export const Gift: LucideIcon
    export const Globe: LucideIcon
    export const Globe2: LucideIcon
    export const Landmark: LucideIcon
    export const Medal: LucideIcon
    export const Percent: LucideIcon
    export const PiggyBank: LucideIcon
    export const Receipt: LucideIcon
    export const ShoppingBag: LucideIcon
    export const ShoppingCart: LucideIcon
    export const Store: LucideIcon
    export const Tag: LucideIcon
    export const Tags: LucideIcon
    export const Target: LucideIcon
    export const TicketCheck: LucideIcon
    export const Trophy: LucideIcon
    export const Wallet: LucideIcon

    // Inventory & Logistics
    export const Barcode: LucideIcon
    export const Box: LucideIcon
    export const Boxes: LucideIcon
    export const Package: LucideIcon
    export const Package2: LucideIcon
    export const PackageOpen: LucideIcon
    export const PackageX: LucideIcon
    export const QrCode: LucideIcon
    export const Ruler: LucideIcon
    export const ScanBarcode: LucideIcon
    export const Truck: LucideIcon
    export const Warehouse: LucideIcon

    // Files & Documents
    export const Clipboard: LucideIcon
    export const ClipboardCheck: LucideIcon
    export const ClipboardList: LucideIcon
    export const File: LucideIcon
    export const FilePlus: LucideIcon
    export const FileQuestion: LucideIcon
    export const FileSpreadsheet: LucideIcon
    export const FileText: LucideIcon
    export const FileUp: LucideIcon
    export const FileWarning: LucideIcon
    export const Folder: LucideIcon
    export const FolderOpen: LucideIcon
    export const FolderTree: LucideIcon
    export const Inbox: LucideIcon
    export const Library: LucideIcon
    export const ScrollText: LucideIcon

    // Layout & UI
    export const Columns: LucideIcon
    export const Grid: LucideIcon
    export const Grid2X2: LucideIcon
    export const Grid3x3: LucideIcon
    export const Grid3X3: LucideIcon
    export const Layout: LucideIcon
    export const LayoutDashboard: LucideIcon
    export const LayoutGrid: LucideIcon
    export const LayoutList: LucideIcon
    export const Layers: LucideIcon
    export const List: LucideIcon
    export const ListChecks: LucideIcon
    export const Menu: LucideIcon
    export const PanelLeft: LucideIcon
    export const PanelRight: LucideIcon
    export const Rows: LucideIcon
    export const Sidebar: LucideIcon
    export const Sliders: LucideIcon
    export const SlidersHorizontal: LucideIcon
    export const Table: LucideIcon

    // Charts & Data
    export const BarChart: LucideIcon
    export const BarChart3: LucideIcon
    export const Gauge: LucideIcon
    export const LineChart: LucideIcon
    export const PieChart: LucideIcon
    export const TrendingDown: LucideIcon
    export const TrendingUp: LucideIcon

    // Tech & System
    export const Bot: LucideIcon
    export const Brain: LucideIcon
    export const Cloud: LucideIcon
    export const Code: LucideIcon
    export const Command: LucideIcon
    export const Cpu: LucideIcon
    export const Database: LucideIcon
    export const DatabaseZap: LucideIcon
    export const GitBranch: LucideIcon
    export const GitCompareArrows: LucideIcon
    export const HardDrive: LucideIcon
    export const Hash: LucideIcon
    export const Puzzle: LucideIcon
    export const Rocket: LucideIcon
    export const Server: LucideIcon
    export const ServerCog: LucideIcon
    export const Settings: LucideIcon
    export const Settings2: LucideIcon
    export const Sparkles: LucideIcon
    export const SquareTerminal: LucideIcon
    export const Terminal: LucideIcon
    export const TestTube: LucideIcon
    export const Wand2: LucideIcon
    export const Wifi: LucideIcon
    export const WifiOff: LucideIcon
    export const Wrench: LucideIcon
    export const Zap: LucideIcon

    // Places & Map
    export const DoorOpen: LucideIcon
    export const Home: LucideIcon
    export const MapPin: LucideIcon

    // Time & Calendar
    export const Calendar: LucideIcon
    export const CalendarClock: LucideIcon
    export const CalendarDays: LucideIcon
    export const CalendarOff: LucideIcon
    export const Clock: LucideIcon
    export const History: LucideIcon
    export const Timer: LucideIcon
    export const Sunset: LucideIcon

    // Communication
    export const BookOpen: LucideIcon
    export const Coffee: LucideIcon
    export const Heart: LucideIcon
    export const LifeBuoy: LucideIcon
    export const Lightbulb: LucideIcon
    export const Mail: LucideIcon
    export const MessageSquare: LucideIcon
    export const MessagesSquare: LucideIcon
    export const Phone: LucideIcon
    export const Star: LucideIcon

    // Media
    export const Camera: LucideIcon
    export const Image: LucideIcon
    export const Palette: LucideIcon
    export const Printer: LucideIcon

    // Shapes & Misc
    export const Circle: LucideIcon
    export const CircleDot: LucideIcon
    export const Cog: LucideIcon
    export const Hammer: LucideIcon
    export const Laptop: LucideIcon
    export const Monitor: LucideIcon
    export const Moon: LucideIcon
    export const Smartphone: LucideIcon
    export const Square: LucideIcon
    export const Sun: LucideIcon
    export const Tablet: LucideIcon
    export const ToggleLeft: LucideIcon
    export const ToggleRight: LucideIcon
    export const Triangle: LucideIcon

}
