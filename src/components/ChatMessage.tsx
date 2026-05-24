import type { Message } from '@/lib/types'

export default function ChatMessage({ message }: { message: Message }) {
  const isPatient = message.role === 'patient'

  return (
    <div className={`flex ${isPatient ? 'justify-end' : 'gap-2'}`}>
      {!isPatient && (
        <div className="w-7 h-7 bg-teal-700 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
          AI
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${
          isPatient
            ? 'bg-teal-700 text-white rounded-2xl rounded-br-sm'
            : 'bg-white text-slate-800 rounded-2xl rounded-bl-sm shadow-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
