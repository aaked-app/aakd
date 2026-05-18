/**
 * Custom SearchAndReplace TipTap extension built on ProseMirror decorations.
 *
 * @tiptap/extension-search-and-replace is a TipTap Pro package — not publicly
 * available on npm. This implementation uses the same ProseMirror decoration
 * primitives and exposes an identical command + storage surface.
 *
 * Commands:
 *   editor.commands.setSearchTerm(term: string)
 *   editor.commands.setReplaceTerm(term: string)
 *   editor.commands.setCaseSensitive(enabled: boolean)
 *   editor.commands.nextSearchResult()
 *   editor.commands.previousSearchResult()
 *   editor.commands.replaceCurrentSearchResult()
 *   editor.commands.replaceAllSearchResults()
 *
 * Storage (read-only from the panel):
 *   editor.storage.searchAndReplace.results: SearchResult[]
 *   editor.storage.searchAndReplace.resultIndex: number
 *
 * CSS classes applied to decorated ranges:
 *   .search-result          — every match
 *   .search-result-current  — the active match
 */

import { Extension } from "@tiptap/core"
import type { CommandProps } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Node as PmNode } from "@tiptap/pm/model"

// ─── Module augmentation — add custom commands to TipTap's type system ─────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType
      setReplaceTerm: (replaceTerm: string) => ReturnType
      setCaseSensitive: (caseSensitive: boolean) => ReturnType
      nextSearchResult: () => ReturnType
      previousSearchResult: () => ReturnType
      replaceCurrentSearchResult: () => ReturnType
      replaceAllSearchResults: () => ReturnType
    }
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SearchResult {
  from: number
  to: number
}

export interface SearchAndReplaceStorage {
  searchTerm: string
  replaceTerm: string
  caseSensitive: boolean
  results: SearchResult[]
  resultIndex: number
}

// ─── Plugin key ────────────────────────────────────────────────────────────────

export const searchAndReplaceKey = new PluginKey<DecorationSet>("searchAndReplace")

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function findMatches(doc: PmNode, searchTerm: string, caseSensitive: boolean): SearchResult[] {
  if (!searchTerm) return []

  const flags = caseSensitive ? "g" : "gi"
  let regex: RegExp
  try {
    regex = new RegExp(searchTerm, flags)
  } catch {
    // Invalid regex — escape and retry as a literal search
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    regex = new RegExp(escaped, flags)
  }

  const results: SearchResult[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(node.text)) !== null) {
      results.push({ from: pos + match.index, to: pos + match.index + match[0].length })
    }
  })
  return results
}

function buildDecorations(
  doc: PmNode,
  results: SearchResult[],
  currentIndex: number,
): DecorationSet {
  if (results.length === 0) return DecorationSet.empty
  const decorations = results.map((r, i) =>
    Decoration.inline(r.from, r.to, {
      class: i === currentIndex ? "search-result search-result-current" : "search-result",
    }),
  )
  return DecorationSet.create(doc, decorations)
}

// ─── Extension ────────────────────────────────────────────────────────────────

export const SearchAndReplace = Extension.create({
  name: "searchAndReplace",

  addStorage(): SearchAndReplaceStorage {
    return {
      searchTerm: "",
      replaceTerm: "",
      caseSensitive: false,
      results: [],
      resultIndex: 0,
    }
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor }: CommandProps) => {
          const s = editor.storage.searchAndReplace as SearchAndReplaceStorage
          s.searchTerm = searchTerm
          s.results = findMatches(editor.state.doc, searchTerm, s.caseSensitive)
          s.resultIndex = 0
          editor.view.dispatch(editor.state.tr.setMeta(searchAndReplaceKey, true))
          return true
        },

      setReplaceTerm:
        (replaceTerm: string) =>
        ({ editor }: CommandProps) => {
          const s = editor.storage.searchAndReplace as SearchAndReplaceStorage
          s.replaceTerm = replaceTerm
          return true
        },

      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor }: CommandProps) => {
          const s = editor.storage.searchAndReplace as SearchAndReplaceStorage
          s.caseSensitive = caseSensitive
          s.results = findMatches(editor.state.doc, s.searchTerm, caseSensitive)
          s.resultIndex = 0
          editor.view.dispatch(editor.state.tr.setMeta(searchAndReplaceKey, true))
          return true
        },

      nextSearchResult:
        () =>
        ({ editor }: CommandProps) => {
          const s = editor.storage.searchAndReplace as SearchAndReplaceStorage
          if (s.results.length === 0) return false
          s.resultIndex = (s.resultIndex + 1) % s.results.length
          editor.view.dispatch(editor.state.tr.setMeta(searchAndReplaceKey, true))
          const current = s.results[s.resultIndex]
          if (current) {
            editor.commands.setTextSelection(current)
            editor.commands.scrollIntoView()
          }
          return true
        },

      previousSearchResult:
        () =>
        ({ editor }: CommandProps) => {
          const s = editor.storage.searchAndReplace as SearchAndReplaceStorage
          if (s.results.length === 0) return false
          s.resultIndex = (s.resultIndex - 1 + s.results.length) % s.results.length
          editor.view.dispatch(editor.state.tr.setMeta(searchAndReplaceKey, true))
          const current = s.results[s.resultIndex]
          if (current) {
            editor.commands.setTextSelection(current)
            editor.commands.scrollIntoView()
          }
          return true
        },

      replaceCurrentSearchResult:
        () =>
        ({ editor, tr, dispatch }: CommandProps) => {
          const s = editor.storage.searchAndReplace as SearchAndReplaceStorage
          const { results, resultIndex, replaceTerm } = s
          if (results.length === 0) return false
          const current = results[resultIndex]
          if (!current) return false
          if (dispatch) {
            tr.insertText(replaceTerm, current.from, current.to)
            dispatch(tr)
          }
          // Recompute after the document mutation settles
          setTimeout(() => {
            const newResults = findMatches(editor.state.doc, s.searchTerm, s.caseSensitive)
            s.results = newResults
            s.resultIndex = Math.min(resultIndex, Math.max(0, newResults.length - 1))
            editor.view.dispatch(editor.state.tr.setMeta(searchAndReplaceKey, true))
          }, 0)
          return true
        },

      replaceAllSearchResults:
        () =>
        ({ editor, tr, dispatch }: CommandProps) => {
          const s = editor.storage.searchAndReplace as SearchAndReplaceStorage
          const { results, replaceTerm } = s
          if (results.length === 0) return false
          if (dispatch) {
            // Replace from end → start so earlier positions remain valid
            for (const result of [...results].reverse()) {
              tr.insertText(replaceTerm, result.from, result.to)
            }
            dispatch(tr)
          }
          s.results = []
          s.resultIndex = 0
          editor.view.dispatch(editor.state.tr.setMeta(searchAndReplaceKey, true))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    // `this` is the Extension instance — its `.storage` is the live shared
    // object, same reference as `editor.storage.searchAndReplace`.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ext = this

    return [
      new Plugin({
        key: searchAndReplaceKey,

        state: {
          init(_, { doc }) {
            const s = ext.storage as SearchAndReplaceStorage
            return buildDecorations(doc, findMatches(doc, s.searchTerm, s.caseSensitive), s.resultIndex)
          },

          apply(tr, decorationSet, _, newState) {
            const s = ext.storage as SearchAndReplaceStorage
            if (tr.docChanged || tr.getMeta(searchAndReplaceKey)) {
              const results = findMatches(newState.doc, s.searchTerm, s.caseSensitive)
              s.results = results
              return buildDecorations(newState.doc, results, s.resultIndex)
            }
            return decorationSet.map(tr.mapping, tr.doc)
          },
        },

        props: {
          decorations(state) {
            return searchAndReplaceKey.getState(state)
          },
        },
      }),
    ]
  },
})
