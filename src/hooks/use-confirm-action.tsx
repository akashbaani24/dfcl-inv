'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type ConfirmOptions = {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

const DEFAULT_MESSAGE =
  'This action will commit your changes. Regular users will not be able to edit or modify the record after this. (Admins can still modify.) Do you want to continue?'

/**
 * Imperative confirmation dialog hook.
 *
 * Usage:
 *   const { confirm } = useConfirmAction()
 *   const handleSubmit = async (e) => {
 *     e.preventDefault()
 *     const ok = await confirm({
 *       title: 'Create Sales Order?',
 *       message: 'This will reduce stock and lock the order. Continue?'
 *     })
 *     if (!ok) return
 *     // ... actually save
 *   }
 *
 * Mount <ConfirmHost /> once near the top of your component tree (e.g. right
 * after the main app shell) — it renders the dialog when confirm() is called.
 */
export function useConfirmAction() {
  const [state, setState] = React.useState<{
    open: boolean
    options: ConfirmOptions
    resolve?: (v: boolean) => void
  }>({ open: false, options: {} })

  const confirm = React.useCallback((options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve })
    })
  }, [])

  const handleClose = (result: boolean) => {
    state.resolve?.(result)
    setState({ open: false, options: {}, resolve: undefined })
  }

  const ConfirmHost = (
    <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) handleClose(false) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.options.title || 'Please confirm'}</AlertDialogTitle>
          <AlertDialogDescription>
            {state.options.message || DEFAULT_MESSAGE}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleClose(false)}>
            {state.options.cancelLabel || 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleClose(true) }}
            className={state.options.destructive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : undefined}
          >
            {state.options.confirmLabel || 'Yes, confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirm, ConfirmHost }
}
