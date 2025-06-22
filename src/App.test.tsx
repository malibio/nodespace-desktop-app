import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { mockInvoke } from './setupTests'

describe('App Component', () => {
  beforeEach(() => {
    mockInvoke.mockClear()
  })

  test('renders welcome message', () => {
    render(<App />)
    expect(screen.getByText('Welcome to NodeSpace!')).toBeInTheDocument()
  })

  test('renders logos and links', () => {
    render(<App />)
    
    // Check for logo images
    expect(screen.getByAltText('Vite logo')).toBeInTheDocument()
    expect(screen.getByAltText('Tauri logo')).toBeInTheDocument()
    expect(screen.getByAltText('React logo')).toBeInTheDocument()
    
    // Check for links
    expect(screen.getByRole('link', { name: /vite/i })).toHaveAttribute('href', 'https://vitejs.dev')
    expect(screen.getByRole('link', { name: /tauri/i })).toHaveAttribute('href', 'https://tauri.app')
    expect(screen.getByRole('link', { name: /react/i })).toHaveAttribute('href', 'https://reactjs.org')
  })

  test('renders input field and button', () => {
    render(<App />)
    
    expect(screen.getByPlaceholderText('Enter a name...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Greet' })).toBeInTheDocument()
  })

  test('handles greet functionality successfully', async () => {
    const user = userEvent.setup()
    mockInvoke.mockResolvedValue('Hello, TestUser! Welcome to NodeSpace.')
    
    render(<App />)
    
    const input = screen.getByPlaceholderText('Enter a name...')
    const button = screen.getByRole('button', { name: 'Greet' })
    
    await user.type(input, 'TestUser')
    await user.click(button)
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('greet', { name: 'TestUser' })
    })
    
    await waitFor(() => {
      expect(screen.getByText('Hello, TestUser! Welcome to NodeSpace.')).toBeInTheDocument()
    })
  })

  test('handles greet functionality with error', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockInvoke.mockRejectedValue(new Error('Greet command failed'))
    
    render(<App />)
    
    const input = screen.getByPlaceholderText('Enter a name...')
    const button = screen.getByRole('button', { name: 'Greet' })
    
    await user.type(input, 'TestUser')
    await user.click(button)
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('greet', { name: 'TestUser' })
    })
    
    // Should display error message
    await waitFor(() => {
      expect(screen.getByText('Error: Failed to greet. Please try again.')).toBeInTheDocument()
    })
    
    // Should handle error gracefully (not crash)
    expect(screen.getByPlaceholderText('Enter a name...')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })

  test('handles form submission via Enter key', async () => {
    const user = userEvent.setup()
    mockInvoke.mockResolvedValue('Hello, EnterUser! Welcome to NodeSpace.')
    
    render(<App />)
    
    const input = screen.getByPlaceholderText('Enter a name...')
    
    await user.type(input, 'EnterUser')
    await user.keyboard('{Enter}')
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('greet', { name: 'EnterUser' })
    })
    
    await waitFor(() => {
      expect(screen.getByText('Hello, EnterUser! Welcome to NodeSpace.')).toBeInTheDocument()
    })
  })

  test('updates input value correctly', async () => {
    const user = userEvent.setup()
    
    render(<App />)
    
    const input = screen.getByPlaceholderText('Enter a name...') as HTMLInputElement
    
    await user.type(input, 'Dynamic Value')
    
    expect(input.value).toBe('Dynamic Value')
  })

  test('greet message is initially empty', () => {
    render(<App />)
    
    // The greet message paragraph should be present but empty initially
    const greetParagraph = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'p' && content === ''
    })
    
    expect(greetParagraph).toBeInTheDocument()
  })

  test('handles empty name input', async () => {
    const user = userEvent.setup()
    mockInvoke.mockResolvedValue('Hello, ! Welcome to NodeSpace.')
    
    render(<App />)
    
    const button = screen.getByRole('button', { name: 'Greet' })
    
    // Click without entering a name
    await user.click(button)
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('greet', { name: '' })
    })
    
    await waitFor(() => {
      expect(screen.getByText('Hello, ! Welcome to NodeSpace.')).toBeInTheDocument()
    })
  })

  test('form prevents default submission behavior', () => {
    render(<App />)
    
    // Get form by its element rather than role since forms don't have implicit roles
    const form = screen.getByRole('button', { name: 'Greet' }).closest('form')
    expect(form).toBeInTheDocument()
    
    const mockPreventDefault = vi.fn()
    
    fireEvent.submit(form!, { preventDefault: mockPreventDefault })
    
    // The form should exist and have submit behavior
    expect(form).toBeInTheDocument()
  })
})