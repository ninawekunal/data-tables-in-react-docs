import { Button } from '@/components/ui/button'
import { BoltIcon, MoonIcon, SunIcon, WidthIcon } from '@/components/ui/icon'
import { useReadingWidth, useTheme } from '@/lib/prefs'

type ReaderControlsProps = {
  bionic: boolean
  onToggleBionic: () => void
}

/** Theme and width live entirely in this bar; bionic is lifted so the article can react. */
export const ReaderControls = ({ bionic, onToggleBionic }: ReaderControlsProps) => {
  const { theme, toggleTheme } = useTheme()
  const { width, cycleWidth } = useReadingWidth()

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={onToggleBionic}
        active={bionic}
        icon={<BoltIcon />}
        aria-label={bionic ? 'Turn bionic reading off' : 'Turn bionic reading on'}
        title="Bionic reading"
      >
        <span className="hidden sm:inline">Bionic</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={cycleWidth}
        className="max-lg:hidden"
        icon={<WidthIcon />}
        aria-label={`Reading width, step ${width + 1} of 3`}
        title="Reading width"
      >
        <span className="hidden sm:inline">Width</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={toggleTheme}
        icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title="Theme"
      />
    </div>
  )
}
