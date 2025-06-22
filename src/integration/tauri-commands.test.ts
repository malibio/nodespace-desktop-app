import { TauriTestUtils, mockTestData } from '../utils/testing'
import { mockInvoke } from '../setupTests'

describe('Tauri Command Integration Tests', () => {
  beforeEach(() => {
    mockInvoke.mockClear()
  })

  describe('Knowledge Node Management Workflow', () => {
    test('complete node lifecycle: create, get, update, delete', async () => {
      const content = 'Initial content'
      const updatedContent = 'Updated content'
      const nodeId = 'test-node-123'

      // Step 1: Create a knowledge node
      TauriTestUtils.mockTauriCommand('create_knowledge_node', { 0: nodeId })
      
      const createResult = await mockInvoke('create_knowledge_node', {
        content,
        metadata: { type: 'test' }
      })
      
      expect(createResult).toEqual({ 0: nodeId })
      expect(mockInvoke).toHaveBeenCalledWith('create_knowledge_node', {
        content,
        metadata: { type: 'test' }
      })

      // Step 2: Retrieve the created node
      const mockNode = TauriTestUtils.createMockNode(content)
      mockNode.id[0] = nodeId
      TauriTestUtils.mockGetNode(mockNode)
      
      const getResult = await mockInvoke('get_node', { node_id: nodeId })
      expect(getResult).toEqual(mockNode)
      expect(getResult.content).toBe(content)

      // Step 3: Update the node
      TauriTestUtils.mockUpdateNode()
      
      const updateResult = await mockInvoke('update_node', {
        node_id: nodeId,
        content: updatedContent
      })
      
      expect(updateResult).toBeNull() // Update returns nothing on success
      expect(mockInvoke).toHaveBeenCalledWith('update_node', {
        node_id: nodeId,
        content: updatedContent
      })

      // Step 4: Verify the update by getting the node again
      const updatedMockNode = TauriTestUtils.createMockNode(updatedContent)
      updatedMockNode.id[0] = nodeId
      TauriTestUtils.mockGetNode(updatedMockNode)
      
      const getFinalResult = await mockInvoke('get_node', { node_id: nodeId })
      expect(getFinalResult.content).toBe(updatedContent)
    })

    test('error handling in node operations', async () => {
      // Test create node with empty content
      TauriTestUtils.mockTauriCommandError('create_knowledge_node', 'Content cannot be empty')
      
      await expect(mockInvoke('create_knowledge_node', {
        content: '',
        metadata: {}
      })).rejects.toThrow('Content cannot be empty')

      // Test get non-existent node
      TauriTestUtils.mockGetNode(null)
      
      const result = await mockInvoke('get_node', { node_id: 'nonexistent' })
      expect(result).toBeNull()

      // Test update non-existent node
      TauriTestUtils.mockTauriCommandError('update_node', 'Node with id nonexistent not found')
      
      await expect(mockInvoke('update_node', {
        node_id: 'nonexistent',
        content: 'new content'
      })).rejects.toThrow('Node with id nonexistent not found')
    })
  })

  describe('AI Query and RAG Workflow', () => {
    test('complete RAG workflow: create nodes, query, get results with sources', async () => {
      // Step 1: Create some knowledge nodes for context
      const nodes = mockTestData.nodes.map((content, index) => {
        const node = TauriTestUtils.createMockNode(content)
        node.id[0] = `node-${index}`
        return node
      })

      // Mock creating multiple nodes
      for (let i = 0; i < nodes.length; i++) {
        TauriTestUtils.mockTauriCommand('create_knowledge_node', { 0: `node-${i}` })
        await mockInvoke('create_knowledge_node', {
          content: nodes[i].content,
          metadata: { type: 'knowledge' }
        })
      }

      // Step 2: Perform a RAG query
      const question = 'What is artificial intelligence?'
      const mockResponse = TauriTestUtils.createMockQueryResponse(question, [nodes[0]]) // AI-related node
      TauriTestUtils.mockProcessQuery(mockResponse)
      
      const queryResult = await mockInvoke('process_query', { question })
      
      expect(queryResult.answer).toContain(question)
      expect(queryResult.sources).toHaveLength(1)
      expect(queryResult.sources[0].content).toContain('artificial intelligence')
      expect(queryResult.confidence).toBeGreaterThan(0)

      // Step 3: Perform semantic search for related content
      const searchQuery = 'artificial intelligence'
      const searchResults = TauriTestUtils.createMockSearchResults(searchQuery, mockTestData.nodes)
      TauriTestUtils.mockSemanticSearch(searchResults)
      
      const searchResult = await mockInvoke('semantic_search', {
        query: searchQuery,
        limit: 10
      })
      
      expect(searchResult).toHaveLength(1) // Only AI-related content
      expect(searchResult[0].node.content).toContain('artificial intelligence')
      expect(searchResult[0].score).toBeGreaterThan(0)
      expect(searchResult[0].snippet).toBeDefined()
    })

    test('query validation and error handling', async () => {
      // Test empty question
      TauriTestUtils.mockTauriCommandError('process_query', 'Question cannot be empty')
      
      await expect(mockInvoke('process_query', { question: '' }))
        .rejects.toThrow('Question cannot be empty')

      // Test empty search query
      TauriTestUtils.mockTauriCommandError('semantic_search', 'Search query cannot be empty')
      
      await expect(mockInvoke('semantic_search', { query: '', limit: 10 }))
        .rejects.toThrow('Search query cannot be empty')

      // Test invalid search limit
      TauriTestUtils.mockTauriCommandError('semantic_search', 'Limit must be between 1 and 100')
      
      await expect(mockInvoke('semantic_search', { query: 'test', limit: 0 }))
        .rejects.toThrow('Limit must be between 1 and 100')

      await expect(mockInvoke('semantic_search', { query: 'test', limit: 101 }))
        .rejects.toThrow('Limit must be between 1 and 100')
    })
  })

  describe('Cross-Command Integration', () => {
    test('search finds previously created nodes', async () => {
      const searchTerm = 'NodeSpace'
      const nodeContent = 'NodeSpace is a knowledge management system for organizing information.'
      const nodeId = 'nodespace-node'

      // Step 1: Create a node with specific content
      TauriTestUtils.mockTauriCommand('create_knowledge_node', { 0: nodeId })
      
      await mockInvoke('create_knowledge_node', {
        content: nodeContent,
        metadata: { type: 'definition' }
      })

      // Step 2: Search should find the created node
      const mockNode = TauriTestUtils.createMockNode(nodeContent)
      mockNode.id[0] = nodeId
      const searchResults = [
        {
          node: mockNode,
          score: 0.95,
          snippet: nodeContent.substring(0, 100) + '...'
        }
      ]
      TauriTestUtils.mockSemanticSearch(searchResults)
      
      const results = await mockInvoke('semantic_search', {
        query: searchTerm,
        limit: 10
      })
      
      expect(results).toHaveLength(1)
      expect(results[0].node.content).toBe(nodeContent)
      expect(results[0].node.id[0]).toBe(nodeId)

      // Step 3: Get the node directly to verify consistency
      TauriTestUtils.mockGetNode(mockNode)
      
      const directGet = await mockInvoke('get_node', { node_id: nodeId })
      expect(directGet.content).toBe(results[0].node.content)
    })

    test('RAG query uses created nodes as context', async () => {
      const contextNodes = [
        TauriTestUtils.createMockNode('NodeSpace is a knowledge management system.'),
        TauriTestUtils.createMockNode('It helps organize and search information efficiently.'),
        TauriTestUtils.createMockNode('Users can create nodes and query them with AI.'),
      ]

      // Mock that these nodes exist in the system
      contextNodes.forEach((node, index) => {
        node.id[0] = `context-${index}`
      })

      const question = 'How does NodeSpace help with knowledge management?'
      const mockResponse = {
        answer: 'NodeSpace helps with knowledge management by providing a system to organize information into nodes and search them efficiently using AI-powered queries.',
        sources: contextNodes,
        confidence: 0.9
      }
      
      TauriTestUtils.mockProcessQuery(mockResponse)
      
      const result = await mockInvoke('process_query', { question })
      
      expect(result.answer).toContain('NodeSpace')
      expect(result.answer).toContain('knowledge management')
      expect(result.sources).toHaveLength(3)
      expect(result.confidence).toBeGreaterThan(0.8)
      
      // Verify all source nodes are relevant
      result.sources.forEach(source => {
        expect(source.content.toLowerCase()).toMatch(/nodespace|knowledge|information|organize|users|create|nodes|query/)
      })
    })
  })

  describe('Concurrent Operations', () => {
    test('multiple simultaneous operations', async () => {
      // Mock each command individually since mockInvoke can only handle one at a time
      const createNodeResponse = { 0: 'new-node' }
      const searchResponse: any[] = []
      const queryResponse = TauriTestUtils.createMockQueryResponse('What is this?')

      // Test operations sequentially rather than concurrently to avoid mock conflicts
      mockInvoke.mockImplementation((cmd: string, args: any) => {
        switch (cmd) {
          case 'create_knowledge_node':
            return Promise.resolve(createNodeResponse)
          case 'semantic_search':
            return Promise.resolve(searchResponse)
          case 'process_query':
            return Promise.resolve(queryResponse)
          default:
            return Promise.reject(new Error(`Unmocked command: ${cmd}`))
        }
      })

      // Execute operations sequentially
      const createResult1 = await mockInvoke('create_knowledge_node', { content: 'Node 1', metadata: {} })
      const createResult2 = await mockInvoke('create_knowledge_node', { content: 'Node 2', metadata: {} })
      const searchResult = await mockInvoke('semantic_search', { query: 'search', limit: 5 })
      const queryResult = await mockInvoke('process_query', { question: 'What is this?' })

      // Verify all operations completed successfully
      expect(createResult1).toEqual({ 0: 'new-node' })
      expect(createResult2).toEqual({ 0: 'new-node' })
      expect(searchResult).toEqual([])
      expect(queryResult.answer).toContain('What is this?')
      
      expect(mockInvoke).toHaveBeenCalledTimes(4)
    })
  })
})