import { TEMPLATES } from '@/data/templates';
import { navigate } from './router';

interface ToolContext {
  registerTool(tool: {
    name: string; title: string; description: string; inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute(input: unknown): Promise<unknown>;
  }, options: { signal: AbortSignal }): void | Promise<void>;
}

/** Optional page tool starts the visible editor; it never saves or publishes. */
export function registerTemplateTool() {
  const context = (document as Document & { modelContext?: ToolContext }).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tool = {
    name: 'start_invitation_editing', title: '청첩장 편집 시작',
    description: 'Open the visible invitation editor with one of the existing designs. Does not save or publish an invitation.',
    inputSchema: { type:'object', properties:{templateId:{type:'string',enum:TEMPLATES.map(t=>t.id)}}, required:['templateId'], additionalProperties:false },
    annotations: {readOnlyHint:false,untrustedContentHint:false},
    async execute(input: unknown) {
      if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error('디자인을 선택해 주세요');
      const value=input as Record<string,unknown>;
      const template=TEMPLATES.find(t=>t.id===value.templateId);
      if (!template || Object.keys(value).some(k=>k!=='templateId')) throw new Error('사용할 수 없는 디자인이에요');
      navigate(`/create/${template.id}`);
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      return {templateId:template.id,route:`/create/${template.id}`,saved:false};
    },
  };
  try {void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});} catch {/* Unsupported registration must not block the editor. */}
  return ()=>lifecycle.abort();
}
