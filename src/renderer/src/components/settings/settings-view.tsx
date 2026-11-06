import { useEffect, useState } from 'react'
import { ArrowLeft, FolderOpen } from '@phosphor-icons/react'
import type { AppInfo } from '@shared/data'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { useUi } from '@/store/ui'
import { Choice, Range, Row, Section, TextField, Toggle } from './controls'

const isMac = window.api.platform === 'darwin'
const mod = isMac ? 'Cmd' : 'Ctrl+Shift'

const SECTIONS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'resources', label: 'Resources' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'about', label: 'About' }
] as const

function Appearance(): React.JSX.Element {
  const theme = useSettings((s) => s.settings.appearance.theme)
  const startMaximized = useSettings((s) => s.settings.window.startMaximized)
  const set = useSettings((s) => s.set)
  return (
    <Section
      title="Appearance"
      description="Follows your system by default. The brand accent changes with the theme: cyan on dark, blue on light."
    >
      <Row label="Theme" htmlFor="theme">
        <Choice
          id="theme"
          value={theme}
          onChange={(v) => set('appearance', 'theme', v)}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ]}
        />
      </Row>
      <Row
        label="Open at screen size"
        hint="The main window opens as large as your screen, but stays a normal window: no full-screen mode, still resizable by dragging its edges."
        htmlFor="start-maximized"
      >
        <Toggle
          id="start-maximized"
          checked={startMaximized}
          onChange={(v) => set('window', 'startMaximized', v)}
        />
      </Row>
    </Section>
  )
}

function Terminal(): React.JSX.Element {
  const t = useSettings((s) => s.settings.terminal)
  const set = useSettings((s) => s.set)
  const chooseDirectory = async (): Promise<void> => {
    const dir = await window.api.app.pickDirectory()
    if (dir) set('terminal', 'startDirectory', dir)
  }
  return (
    <div className="flex flex-col gap-10">
      <Section title="Text" description="Applied to every open terminal right away.">
        <Row label="Font" htmlFor="font">
          <Choice
            id="font"
            value={t.font}
            onChange={(v) => set('terminal', 'font', v)}
            options={[
              { value: 'geist-mono', label: 'Geist Mono' },
              { value: 'system', label: 'System monospace' },
              { value: 'custom', label: 'Custom' }
            ]}
          />
        </Row>
        {t.font === 'custom' && (
          <Row
            label="Font family"
            hint="Any font installed on this computer."
            htmlFor="custom-font"
          >
            <TextField
              id="custom-font"
              value={t.customFontFamily}
              placeholder="JetBrains Mono"
              onCommit={(v) => set('terminal', 'customFontFamily', v)}
            />
          </Row>
        )}
        <Row label="Font size" htmlFor="font-size">
          <Range
            id="font-size"
            value={t.fontSize}
            min={10}
            max={22}
            step={1}
            format={(v) => `${v}px`}
            onChange={(v) => set('terminal', 'fontSize', v)}
          />
        </Row>
        <Row label="Line height" htmlFor="line-height">
          <Range
            id="line-height"
            value={t.lineHeight}
            min={1}
            max={1.6}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => set('terminal', 'lineHeight', v)}
          />
        </Row>
        <Row label="Cursor" htmlFor="cursor">
          <Choice
            id="cursor"
            value={t.cursorStyle}
            onChange={(v) => set('terminal', 'cursorStyle', v)}
            options={[
              { value: 'bar', label: 'Bar' },
              { value: 'block', label: 'Block' },
              { value: 'underline', label: 'Underline' }
            ]}
          />
        </Row>
        <Row label="Blinking cursor" htmlFor="blink">
          <Toggle
            id="blink"
            checked={t.cursorBlink}
            onChange={(v) => set('terminal', 'cursorBlink', v)}
          />
        </Row>
        <Row
          label="Scrollback"
          hint="Lines kept per terminal. More lines use more memory."
          htmlFor="scrollback"
        >
          <Choice
            id="scrollback"
            value={t.scrollback}
            onChange={(v) => set('terminal', 'scrollback', v)}
            options={[1000, 5000, 10000, 50000, 100000].map((n) => ({
              value: n,
              label: n.toLocaleString('en-US')
            }))}
          />
        </Row>
      </Section>

      <Section title="Shell" description="Applied to terminals you open from now on.">
        <Row
          label="Shell"
          hint="Leave empty for the default: your login shell on macOS, PowerShell on Windows."
          htmlFor="shell"
        >
          <TextField
            id="shell"
            value={t.shell}
            placeholder={isMac ? '/bin/zsh' : 'powershell.exe'}
            onCommit={(v) => set('terminal', 'shell', v)}
          />
        </Row>
        <Row label="Start directory" hint="Leave empty to start in your home folder." htmlFor="cwd">
          <TextField
            id="cwd"
            value={t.startDirectory}
            placeholder="Home"
            onCommit={(v) => set('terminal', 'startDirectory', v)}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Choose folder"
            onClick={chooseDirectory}
          >
            <FolderOpen />
          </Button>
        </Row>
      </Section>

      <Section title="Behavior">
        {isMac && (
          <Row
            label="Option key as Meta"
            hint="Lets Option act as Alt in shells and editors (word jumps, vim)."
            htmlFor="meta"
          >
            <Toggle
              id="meta"
              checked={t.optionAsMeta}
              onChange={(v) => set('terminal', 'optionAsMeta', v)}
            />
          </Row>
        )}
        <Row
          label="Copy on select"
          hint="Copies text to the clipboard as soon as you select it."
          htmlFor="copy-select"
        >
          <Toggle
            id="copy-select"
            checked={t.copyOnSelect}
            onChange={(v) => set('terminal', 'copyOnSelect', v)}
          />
        </Row>
      </Section>
    </div>
  )
}

function Workspaces(): React.JSX.Element {
  const w = useSettings((s) => s.settings.workspaces)
  const set = useSettings((s) => s.set)
  return (
    <Section
      title="Workspaces"
      description="Names, notes and colors are always saved. These control what happens at startup and for new terminals."
    >
      <Row
        label="Restore workspaces on launch"
        hint="Reopens your workspaces with their names, notes and colors. Shells start fresh."
        htmlFor="restore"
      >
        <Toggle
          id="restore"
          checked={w.restoreOnLaunch}
          onChange={(v) => set('workspaces', 'restoreOnLaunch', v)}
        />
      </Row>
      <Row
        label="Color new terminals automatically"
        hint="Gives each new terminal the next unused color from the palette."
        htmlFor="auto-color"
      >
        <Toggle
          id="auto-color"
          checked={w.autoColor}
          onChange={(v) => set('workspaces', 'autoColor', v)}
        />
      </Row>
    </Section>
  )
}

function Resources(): React.JSX.Element {
  const r = useSettings((s) => s.settings.resources)
  const set = useSettings((s) => s.set)
  const setShow = (key: keyof typeof r.showInSidebar, v: boolean): void =>
    set('resources', 'showInSidebar', { ...r.showInSidebar, [key]: v })
  return (
    <div className="flex flex-col gap-10">
      <Section
        title="Monitoring"
        description="Sampling only runs while something is showing it, so hiding every metric costs nothing."
      >
        <Row label="Update every" htmlFor="interval">
          <Choice
            id="interval"
            value={r.intervalMs}
            onChange={(v) => set('resources', 'intervalMs', v)}
            options={[
              { value: 1000, label: '1 second' },
              { value: 2000, label: '2 seconds' },
              { value: 5000, label: '5 seconds' }
            ]}
          />
        </Row>
        <Row label="Network and disk units" htmlFor="unit">
          <Choice
            id="unit"
            value={r.networkUnit}
            onChange={(v) => set('resources', 'networkUnit', v)}
            options={[
              { value: 'bytes', label: 'Bytes per second' },
              { value: 'bits', label: 'Bits per second' }
            ]}
          />
        </Row>
        <Row
          label="Keep pop-outs on top"
          hint="Pop-out windows float above other windows. You can change it per window."
          htmlFor="on-top"
        >
          <Toggle
            id="on-top"
            checked={r.popoutAlwaysOnTop}
            onChange={(v) => set('resources', 'popoutAlwaysOnTop', v)}
          />
        </Row>
      </Section>
      <Section title="Shown in the sidebar">
        {(
          [
            ['cpu', 'CPU'],
            ['ram', 'RAM'],
            ['disk', 'Disk I/O'],
            ['net', 'Network I/O']
          ] as const
        ).map(([key, label]) => (
          <Row key={key} label={label} htmlFor={`show-${key}`}>
            <Toggle
              id={`show-${key}`}
              checked={r.showInSidebar[key]}
              onChange={(v) => setShow(key, v)}
            />
          </Row>
        ))}
      </Section>
    </div>
  )
}

function Shortcuts(): React.JSX.Element {
  const rows: Array<[string, string]> = [
    ['New terminal', `${mod}+T`],
    ['Close terminal', `${mod}+W`],
    ['New workspace', `${mod}+N`],
    ['Settings', isMac ? 'Cmd+,' : 'Ctrl+Shift+,']
  ]
  if (!isMac) rows.push(['Copy / paste', 'Ctrl+Shift+C / V'])
  return (
    <Section title="Shortcuts" description="Shown for reference. Remapping is not available yet.">
      {rows.map(([label, keys]) => (
        <Row key={label} label={label}>
          <kbd className="bg-muted rounded-md border px-2 py-0.5 font-mono text-xs">{keys}</kbd>
        </Row>
      ))}
    </Section>
  )
}

function About(): React.JSX.Element {
  const reset = useSettings((s) => s.reset)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => void window.api.app.info().then(setInfo), [])
  useEffect(() => {
    if (!confirming) return
    const t = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(t)
  }, [confirming])

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <BrandLogo className="text-foreground h-6 w-auto self-start" />
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold tracking-tight">sdterm</h2>
          <p className="text-muted-foreground max-w-[56ch] text-sm">
            A terminal workspace by SEM Devs: many terminals in one window, each with a name, a note
            and a color, plus live resource monitors you can pop out.
          </p>
          <p className="text-muted-foreground text-xs">
            Version {info?.version ?? '...'} ·{' '}
            <a
              href="https://sem-devs.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              sem-devs.com
            </a>
          </p>
        </div>
      </section>

      <Section title="Your data">
        <Row label="Settings file" hint={info?.storePath ?? ''}>
          <Button variant="outline" onClick={() => window.api.app.revealStore()}>
            Show in folder
          </Button>
        </Row>
        <Row
          label="Reset all settings"
          hint="Restores every option on this page to its default. Workspaces are kept."
        >
          <Button
            variant={confirming ? 'destructive' : 'outline'}
            onClick={() => {
              if (confirming) {
                reset()
                setConfirming(false)
              } else setConfirming(true)
            }}
          >
            {confirming ? 'Click again to confirm' : 'Reset'}
          </Button>
        </Row>
      </Section>
    </div>
  )
}

export function SettingsView(): React.JSX.Element {
  const section = useUi((s) => s.settingsSection)
  const setSection = (id: string): void => useUi.setState({ settingsSection: id })
  const setView = useUi((s) => s.setView)

  const panels: Record<string, React.JSX.Element> = {
    appearance: <Appearance />,
    terminal: <Terminal />,
    workspaces: <Workspaces />,
    resources: <Resources />,
    shortcuts: <Shortcuts />,
    about: <About />
  }

  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label="Settings sections"
        className="flex w-44 shrink-0 flex-col gap-0.5 border-r p-2"
      >
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 justify-start"
          onClick={() => setView('terminals')}
        >
          <ArrowLeft /> Terminals
        </Button>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            aria-current={section === s.id ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/60 h-8 rounded-md px-2 text-left text-[13px] transition-colors outline-none focus-visible:ring-2',
              section === s.id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="max-w-2xl px-10 py-8">{panels[section] ?? panels.appearance}</div>
      </div>
    </div>
  )
}
