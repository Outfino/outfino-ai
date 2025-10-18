import { query } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'crypto';

async function testClaude() {
    try {
        console.log('🧪 Testing Claude Agent SDK...');
        
        const sessionId = randomUUID();
        const messageIterable = async function*() {
            yield {
                type: 'user',
                uuid: randomUUID(),
                session_id: sessionId,
                message: {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Just say "Hello" and nothing else.'
                        }
                    ]
                },
                parent_tool_use_id: null
            };
        }();

        let resultText = '';
        for await (const msg of query({
            prompt: messageIterable,
            options: {
                maxTurns: 1,
                model: 'claude-sonnet-4-5-20250929'
            }
        })) {
            console.log('Message type:', msg.type);
            if (msg.type === 'result') {
                resultText = msg.result;
                console.log('✅ Result:', resultText);
            } else {
                console.log('Message:', JSON.stringify(msg, null, 2));
            }
        }

        if (!resultText) {
            console.error('❌ No result received');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testClaude();
