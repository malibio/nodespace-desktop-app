import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { mockInvoke } from './setupTests'

describe('App Component', () => {
  beforeEach(() => {
    mockInvoke.mockClear()
    mockInvoke.mockResolvedValue([])
  })

  test('renders NodeSpace application title', () => {
    render(<App />)
    expect(screen.getByText('NodeSpace')).toBeInTheDocument()
  })

  test('renders date navigation', () => {
    render(<App />)
    
    expect(screen.getByRole('button', { name: '←' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '→' })).toBeInTheDocument()
    expect(screen.getByText(/nodes:/i)).toBeInTheDocument()
  })

  test('renders theme toggle button', () => {
    render(<App />)
    
    const themeToggle = screen.getByRole('button', { name: '🌙' })
    expect(themeToggle).toBeInTheDocument()
  })

  test('loads nodes for current date on mount', async () => {
    render(<App />)
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_nodes_for_date', {
        dateStr: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      })
    })
  })

  test('handles theme toggle', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    const themeToggle = screen.getByRole('button', { name: '🌙' })
    
    await user.click(themeToggle)
    
    expect(screen.getByRole('button', { name: '☀️' })).toBeInTheDocument()
    expect(document.querySelector('.app')).toHaveClass('dark-mode')
  })

  test('navigates to previous day', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    const prevButton = screen.getByRole('button', { name: '←' })
    
    await user.click(prevButton)
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })

  test('navigates to next day', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    const nextButton = screen.getByRole('button', { name: '→' })
    
    await user.click(nextButton)
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })

  test('handles date loading error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockInvoke.mockRejectedValue(new Error('Failed to load nodes'))
    
    render(<App />)
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled()
    })
    
    expect(screen.getByText('NodeSpace')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })

  test('displays node count', () => {
    render(<App />)
    
    expect(screen.getByText(/nodes: \d+/i)).toBeInTheDocument()
  })

  test('renders NodeSpaceEditor component', () => {
    render(<App />)
    
    const mainContent = document.querySelector('.main-content')
    expect(mainContent).toBeInTheDocument()
  })
})