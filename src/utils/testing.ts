import { mockInvoke } from '../setupTests'

export interface MockNode {
  id: { 0: string }
  content: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface MockQueryResponse {
  answer: string
  sources: MockNode[]
  confidence: number
}

export interface MockSearchResult {
  node: MockNode
  score: number
  snippet: string
}

export class TauriTestUtils {
  static createMockNode(content: string): MockNode {
    const now = new Date().toISOString()
    return {
      id: { 0: 'mock-node-id-' + Math.random().toString(36).substr(2, 9) },
      content,
      metadata: { type: 'test' },
      created_at: now,
      updated_at: now,
    }
  }

  static createMockQueryResponse(question: string, sources: MockNode[] = []): MockQueryResponse {
    return {
      answer: `Mock response to: ${question}`,
      sources,
      confidence: 0.8,
    }
  }

  static createMockSearchResults(query: string, nodeContents: string[]): MockSearchResult[] {
    return nodeContents
      .filter(content => content.toLowerCase().includes(query.toLowerCase()))
      .map(content => ({
        node: this.createMockNode(content),
        score: 0.9,
        snippet: content.substring(0, 100) + '...',
      }))
  }

  static mockTauriCommand(command: string, response: unknown) {
    mockInvoke.mockImplementation((cmd: string, args: unknown) => {
      if (cmd === command) {
        return Promise.resolve(response)
      }
      return Promise.reject(new Error(`Unmocked command: ${cmd}`))
    })
  }

  static mockTauriCommandError(command: string, error: string) {
    mockInvoke.mockImplementation((cmd: string, args: unknown) => {
      if (cmd === command) {
        return Promise.reject(new Error(error))
      }
      return Promise.reject(new Error(`Unmocked command: ${cmd}`))
    })
  }

  static mockCreateKnowledgeNode(nodeId: string = 'test-node-id') {
    this.mockTauriCommand('create_knowledge_node', { 0: nodeId })
  }

  static mockUpdateNode() {
    this.mockTauriCommand('update_node', null)
  }

  static mockGetNode(node: MockNode | null) {
    this.mockTauriCommand('get_node', node)
  }

  static mockProcessQuery(response: MockQueryResponse) {
    this.mockTauriCommand('process_query', response)
  }

  static mockSemanticSearch(results: MockSearchResult[]) {
    this.mockTauriCommand('semantic_search', results)
  }
}

// Test data generators
export const mockTestData = {
  nodes: [
    'This is a test document about artificial intelligence and machine learning.',
    'NodeSpace is a knowledge management system for organizing information.',
    'Tauri enables building desktop applications with web technologies.',
    'React is a popular JavaScript library for building user interfaces.',
  ],

  questions: [
    'What is artificial intelligence?',
    'How does NodeSpace work?',
    'What are the benefits of Tauri?',
    'Why use React for UI development?',
  ],

  searchQueries: [
    'artificial intelligence',
    'NodeSpace',
    'Tauri',
    'React',
    'nonexistent term',
  ],
}