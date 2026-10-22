import { useApplicationsLoaded } from '../apps/index.ts'
import { useElementSize } from '../ui/useElementSize.ts'
import { useBarPlacement } from './bar-placement.ts'
import { ConnectionStatus } from './ConnectionStatus.tsx'
import { useShellController } from './controller/useShellController.ts'
import { Desktop } from './Desktop.tsx'
import styles from './Shell.module.css'
import { TaskBar } from './TaskBar.tsx'
import { Workspace } from './Workspace.tsx'

export function Shell() {
  const loaded = useApplicationsLoaded()
  const [main, size] = useElementSize<HTMLDivElement>()
  const controller = useShellController(size)
  const placement = useBarPlacement()

  return (
    <div className={styles.shell} data-bar={placement} data-home={controller.home}>
      <div className={styles.titleBar} />
      <div ref={main} className={styles.screen}>
        {loaded && size && (
          <>
            <Workspace
              windows={controller.windows}
              panes={controller.panes}
              layout={controller.layout}
              hidden={controller.home}
              onFocus={controller.focus}
              onLayout={controller.chooseLayout}
              onExit={controller.exitSplit}
              onPick={controller.pick}
              picking={controller.picking}
              unavailableApps={controller.unavailableApps}
              onSwap={controller.swap}
              onCancel={controller.cancel}
              size={size}
              portrait={controller.portrait}
              onTitle={controller.onTitle}
              onOpen={controller.open}
            />
            {controller.home && <Desktop onOpen={controller.open} />}
          </>
        )}
      </div>
      {placement !== 'hidden' && (
        <TaskBar
          placement={placement}
          windows={controller.windows}
          groups={controller.groups}
          locked={controller.picking}
          panes={controller.panes}
          focused={controller.focused}
          focusedSlot={controller.slot}
          home={controller.home}
          layout={controller.layout}
          allowed={controller.allowed}
          portrait={controller.portrait}
          onHome={controller.toggleHome}
          onShow={controller.show}
          onSplit={controller.split}
          onClose={controller.close}
        />
      )}
      <ConnectionStatus />
    </div>
  )
}
