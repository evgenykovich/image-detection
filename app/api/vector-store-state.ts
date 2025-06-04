// Simple in-memory cache for vector store state
let vectorStoreState: {
  [namespace: string]: {
    lastCleared: number
    knownEmpty: boolean
  }
} = {}

export function markNamespaceAsCleared(namespace: string) {
  vectorStoreState[namespace] = {
    lastCleared: Date.now(),
    knownEmpty: true,
  }
}

export function markNamespaceAsPopulated(namespace: string) {
  if (vectorStoreState[namespace]) {
    vectorStoreState[namespace].knownEmpty = false
  } else {
    vectorStoreState[namespace] = {
      lastCleared: 0,
      knownEmpty: false,
    }
  }
}

export function isNamespaceKnownEmpty(namespace: string): boolean {
  return vectorStoreState[namespace]?.knownEmpty ?? false
}

export function getNamespaceState(namespace: string) {
  return vectorStoreState[namespace]
}

// Clear state after 1 hour to prevent stale data
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  Object.keys(vectorStoreState).forEach((namespace) => {
    if (vectorStoreState[namespace].lastCleared < oneHourAgo) {
      delete vectorStoreState[namespace]
    }
  })
}, 60 * 60 * 1000)
