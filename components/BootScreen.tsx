import type React from 'react';

type BootScreenProps = {
  bootStep: number;
  onStart: () => void;
};

const BootScreen: React.FC<BootScreenProps> = ({ bootStep, onStart }) => {
  return (
          <div className="relative w-full h-screen bg-black text-holo-cyan font-mono flex flex-col items-center justify-center overflow-hidden">
              <div className="scanlines opacity-20"></div>
              
              {/* Background geometric elements */}
              <div className="absolute w-[600px] h-[600px] border border-gray-800 rounded-full animate-spin-slow opacity-30"></div>
              <div className="absolute w-[400px] h-[400px] border border-dashed border-klein-blue rounded-full animate-spin-reverse-slow opacity-30"></div>
              
              {bootStep === 0 && (
                  <button 
                    onClick={onStart}
                    className="z-10 group relative px-8 py-4 bg-transparent border border-holo-cyan text-holo-cyan font-display font-bold tracking-[0.3em] text-xl hover:bg-holo-cyan/10 transition-all duration-300 cursor-pointer"
                  >
                    <div className="absolute inset-0 w-full h-full border border-holo-cyan blur-[2px] opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    Init J.A.R.V.I.S.
                  </button>
              )}

              {bootStep >= 1 && (
                  <div className="z-10 flex flex-col items-center gap-4 w-96">
                      <div className="text-2xl font-display font-bold animate-pulse">
                          {bootStep === 1 && "系统启动中..."}
                          {bootStep === 2 && "加载神经网络..."}
                          {bootStep === 3 && "身份验证中..."}
                      </div>
                      <div className="w-full h-1 bg-gray-800 rounded overflow-hidden">
                          <div 
                            className="h-full bg-holo-cyan shadow-[0_0_10px_#00F0FF] transition-all duration-1000 ease-out"
                            style={{ width: bootStep === 1 ? '10%' : bootStep === 2 ? '60%' : '100%' }}
                          ></div>
                      </div>
                      <div className="text-xs text-gray-500 h-20 overflow-hidden w-full text-center leading-tight">
                          {bootStep >= 1 && <div> 内存分配检查... 完成</div>}
                          {bootStep >= 1 && <div> GPU 委托... 已分配</div>}
                          {bootStep >= 2 && <div> 加载 MEDIA_PIPE.WASM...</div>}
                          {bootStep >= 2 && <div> 连接卫星信号...</div>}
                          {bootStep >= 3 && <div> 视网膜扫描... 已绕过</div>}
                          {bootStep >= 3 && <div className="text-green-500"> 访问被允许</div>}
                      </div>
                  </div>
              )}
              
              <div className="absolute bottom-8 text-[10px] text-gray-600">斯塔克工业 专有技术</div>
          </div>
  );
};

export default BootScreen;
