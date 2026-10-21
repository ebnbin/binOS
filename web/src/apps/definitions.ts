import type { ApplicationDefinition } from './types.ts'

export const findApplication = (applications: ApplicationDefinition[], id: string) => applications.find((application) => application.id === id)

export function windowView(application: ApplicationDefinition | undefined, viewId: string) {
  const view = application?.views[viewId]
  return view?.kind === 'window' ? view : undefined
}

export function widgetView(application: ApplicationDefinition | undefined, widgetId: string) {
  const widget = application?.widgets?.[widgetId]
  const view = widget && application?.views[widget.viewId]
  return view?.kind === 'widget' ? view : undefined
}

export function validateApplications(applications: ApplicationDefinition[]): ApplicationDefinition[] {
  for (const application of applications) {
    if (!windowView(application, application.mainWindow.viewId)) {
      throw new Error(`Invalid main window view: ${application.id}/${application.mainWindow.viewId}`)
    }
    for (const widgetId of Object.keys(application.widgets ?? {})) {
      if (!widgetView(application, widgetId)) {
        throw new Error(`Invalid widget view: ${application.id}/${widgetId}`)
      }
    }
  }
  return applications
}
