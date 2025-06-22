import { TauriTestUtils, mockTestData } from './testing'
import { mockInvoke } from '../setupTests'

describe('TauriTestUtils', () => {
  beforeEach(() => {
    mockInvoke.mockClear()
  })

  test('createMockNode generates valid node structure', () => {
    const content = 'Test content'
    const node = TauriTestUtils.createMockNode(content)
    
    expect(node.content).toBe(content)
    expect(node.id[0]).toMatch(/^mock-node-id-[a-z0-9]+$/)
    expect(typeof node.created_at).toBe('string')
    expect(typeof node.updated_at).toBe('string')
    expect(node.metadata.type).toBe('test')
  })

  test('createMockQueryResponse generates valid response', () => {
    const question = 'What is NodeSpace?'
    const sources = [TauriTestUtils.createMockNode('Source content')]
    const response = TauriTestUtils.createMockQueryResponse(question, sources)
    
    expect(response.answer).toContain(question)
    expect(response.sources).toEqual(sources)
    expect(response.confidence).toBe(0.8)
  })

  test('createMockSearchResults filters and maps content correctly', () => {
    const query = 'test'
    const contents = ['This is a test', 'No match here', 'Another test case']
    const results = TauriTestUtils.createMockSearchResults(query, contents)
    
    expect(results).toHaveLength(2)
    expect(results[0].node.content).toBe('This is a test')
    expect(results[1].node.content).toBe('Another test case')
    expect(results[0].score).toBe(0.9)
    expect(results[0].snippet).toContain('This is a test')
  })

  test('mockTauriCommand sets up mock correctly', async () => {
    const testResponse = { success: true }
    TauriTestUtils.mockTauriCommand('test_command', testResponse)
    
    const result = await mockInvoke('test_command', { arg: 'value' })
    expect(result).toEqual(testResponse)
    expect(mockInvoke).toHaveBeenCalledWith('test_command', { arg: 'value' })
  })

  test('mockTauriCommandError sets up error mock correctly', async () => {
    const errorMessage = 'Test error message'
    TauriTestUtils.mockTauriCommandError('failing_command', errorMessage)
    
    await expect(mockInvoke('failing_command', {})).rejects.toThrow(errorMessage)
  })

  test('mockCreateKnowledgeNode sets up correct mock', async () => {
    const nodeId = 'custom-node-id'
    TauriTestUtils.mockCreateKnowledgeNode(nodeId)
    
    const result = await mockInvoke('create_knowledge_node', { content: 'test' })
    expect(result).toEqual({ 0: nodeId })
  })

  test('mockUpdateNode sets up correct mock', async () => {
    TauriTestUtils.mockUpdateNode()
    
    const result = await mockInvoke('update_node', { node_id: 'test', content: 'new content' })
    expect(result).toBeNull()
  })

  test('mockGetNode sets up correct mock with node', async () => {
    const node = TauriTestUtils.createMockNode('Test content')
    TauriTestUtils.mockGetNode(node)
    
    const result = await mockInvoke('get_node', { node_id: 'test' })
    expect(result).toEqual(node)
  })

  test('mockGetNode sets up correct mock with null', async () => {
    TauriTestUtils.mockGetNode(null)
    
    const result = await mockInvoke('get_node', { node_id: 'nonexistent' })
    expect(result).toBeNull()
  })

  test('mockProcessQuery sets up correct mock', async () => {
    const question = 'Test question'
    const response = TauriTestUtils.createMockQueryResponse(question)
    TauriTestUtils.mockProcessQuery(response)
    
    const result = await mockInvoke('process_query', { question })
    expect(result).toEqual(response)
  })

  test('mockSemanticSearch sets up correct mock', async () => {
    const results = TauriTestUtils.createMockSearchResults('test', ['test content'])
    TauriTestUtils.mockSemanticSearch(results)
    
    const result = await mockInvoke('semantic_search', { query: 'test', limit: 10 })
    expect(result).toEqual(results)
  })
})

describe('mockTestData', () => {
  test('contains expected test data structure', () => {
    expect(mockTestData.nodes).toBeInstanceOf(Array)
    expect(mockTestData.questions).toBeInstanceOf(Array)
    expect(mockTestData.searchQueries).toBeInstanceOf(Array)
    
    expect(mockTestData.nodes.length).toBeGreaterThan(0)
    expect(mockTestData.questions.length).toBeGreaterThan(0)
    expect(mockTestData.searchQueries.length).toBeGreaterThan(0)
    
    // Verify all items are strings
    mockTestData.nodes.forEach(node => expect(typeof node).toBe('string'))
    mockTestData.questions.forEach(question => expect(typeof question).toBe('string'))
    mockTestData.searchQueries.forEach(query => expect(typeof query).toBe('string'))
  })
})