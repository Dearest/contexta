export default function Header() {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <img src="/icon/128.png" alt="Contexta" className="w-7 h-7 rounded-md" />
        <span className="font-semibold text-[15px] text-gray-800">Contexta</span>
      </div>
      <button onClick={() => chrome.runtime.openOptionsPage()} className="bg-transparent border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer">⚙️ 设置</button>
    </div>
  )
}
