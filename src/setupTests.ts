import '@testing-library/jest-dom'

// Mock Tauri API for testing
const mockInvoke = vi.fn()

Object.defineProperty(window, '__TAURI__', {
  value: {
    core: {
      invoke: mockInvoke,
    },
  },
})

// Mock Tauri API invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

// Export mock for use in tests
export { mockInvoke }