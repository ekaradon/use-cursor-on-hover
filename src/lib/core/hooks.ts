import { useEventListener } from '@/hooks/useEventListener'
import { useHover } from '@/hooks/useHover'
import { isDefined, isDifferent, mapTuple } from '@/utils/data'
import { CSSProperties, RefObject, useEffect, useRef } from 'react'
import { setGlobalStyle, setRules, useStore, useStoreDispatch } from './store'
import { Effect, Effects } from './effects'
import { Shape, Shapes } from './shapes'
import { computeStyle, defaultCursorStyles, GlobalStyle, Style } from './style'

export function useHideSystemCursor<T extends HTMLElement>(hoverTarget?: RefObject<T>) {
  const previousCursor = useRef(document.body.style.cursor)

  useHover(
    () => (document.body.style.cursor = 'none'),
    () => (document.body.style.cursor = previousCursor.current),
    hoverTarget,
  )
}

export function useGlobalStyle({ color, height, width }: Partial<GlobalStyle> = {}): GlobalStyle {
  useEffect(() => {
    const globalStyle: Partial<GlobalStyle> = Object.entries({ color, height, width })
      .filter(([, value]) => isDefined(value))
      .reduce((globalStyle, [key, value]) => ({ ...globalStyle, [key]: value }), {})

    setGlobalStyle((prev) => ({ ...prev, globalStyle }))
  }, [color, height, width])

  return useStore((state) => state.globalStyle)
}

export function useStyles() {
  const setCursor = useStoreDispatch('cursor')
  const cursor = useStore((state) => state.cursor)
  const globalStyle = useStore((state) => state.globalStyle)
  const styles = useStore((state) => state.rules).map(({ style, context }) =>
    computeStyle({
      style,
      globalStyle: globalStyle,
      target: context?.target,
      cursor,
    }),
  )

  const transform = styles
    .map(({ transform }) => transform)
    .filter(isDefined)
    .join(' ')

  const style: CSSProperties = Object.assign({}, defaultCursorStyles, ...styles, {
    transform,
  })

  useEventListener('mousemove', (event) => {
    if (cursor) {
      cursor.style.top = event.pageY + 'px'
      cursor.style.left = event.pageX + 'px'
    }
  })

  return { ref: setCursor, style }
}

type EffectStyles = `Effect.${Effect}`
type ShapeStyles = `Shape.${Shape}`

function getNamespaceAndName(style: EffectStyles | ShapeStyles) {
  return style.split('.') as ['Effect', Effect] | ['Shape', Shape]
}

type CursorStylePayload = Style | EffectStyles | ShapeStyles
function getStyleFromPayload<T extends HTMLElement>(target: RefObject<T>) {
  return (payload: CursorStylePayload): { style: Style; context?: { target?: RefObject<T> } } => {
    function getStyle(): Style {
      if (typeof payload === 'string') {
        const [namespace, name] = getNamespaceAndName(payload)
        switch (namespace) {
          case 'Effect':
            return Effects[name]
          case 'Shape':
            return Shapes[name]
          default:
            throw Error(`Invalid call to useCursorStyleOnHover(${payload})`)
        }
      }
      return payload
    }
    return { style: getStyle(), context: { target } }
  }
}

export function useCursorStyle<T extends HTMLElement>(
  ...payloads: [CursorStylePayload, ...CursorStylePayload[]]
) {
  const target = useRef<T>(null)
  const newRulesRef = useRef(mapTuple(payloads, getStyleFromPayload<T>(target)))

  useEffect(() => {
    const scopedRules = newRulesRef.current

    setRules((rules) => [...rules, ...scopedRules])

    return () => setRules((rules) => rules.filter((rule) => scopedRules.every(isDifferent(rule))))
  }, [])

  return target
}

export function useCursorStyleOnHover<T extends HTMLElement>(
  ...payloads: [CursorStylePayload, ...CursorStylePayload[]]
) {
  const target = useRef<T>(null)
  const newRulesRef = useRef(mapTuple(payloads, getStyleFromPayload<T>(target)))

  useHover(
    () => setRules((rules) => [...rules, ...newRulesRef.current]),
    () => setRules((rules) => rules.filter((rule) => newRulesRef.current.every(isDifferent(rule)))),
    target,
  )

  return target
}
