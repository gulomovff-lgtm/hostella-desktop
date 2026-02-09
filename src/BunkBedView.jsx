import { User, Plus, AlertCircle } from 'lucide-react';

const BunkBed = ({ bedNumber, topGuest, bottomGuest, onBedClick, room }) => {
    const now = new Date();

    const getGuestStatus = (guest) => {
        if (!guest) return null;
        
        const totalPaid = getTotalPaid(guest);
        const debt = (guest.totalPrice || 0) - totalPaid;
        const isCheckedOut = guest.status === 'checked_out';
        
        const checkOut = new Date(guest.checkOutDate);
        if (typeof guest.checkOutDate === 'string' && !guest.checkOutDate.includes('T')) {
            checkOut.setHours(12, 0, 0, 0);
        }
        const isExpired = now >= checkOut && !isCheckedOut;
        
        return {
            guest,
            debt,
            isCheckedOut,
            isExpired,
            isBooking: guest.status === 'booking',
            bgClass: guest.status === 'booking' ? 'bg-amber-100 border-amber-300' :
                    isCheckedOut ? 'bg-slate-200 border-slate-400' :
                    isExpired ? 'bg-slate-200 border-slate-400' :
                    debt > 0 ? 'bg-rose-100 border-rose-300' :
                    'bg-emerald-100 border-emerald-300'
        };
    };

    const topStatus = getGuestStatus(topGuest);
    const bottomStatus = getGuestStatus(bottomGuest);

    const renderBed = (guest, status, isTop) => {
        const bedId = isTop ? bedNumber * 2 : bedNumber * 2 - 1;
        
        return (
            <div 
                onClick={() => onBedClick(room, bedId, guest, null)}
                className={`relative h-20 border-2 rounded-lg cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${
                    status ? status.bgClass : 'bg-white border-slate-300 hover:border-blue-400'
                }`}
            >
                {/* Матрас */}
                <div className="absolute inset-x-2 bottom-2 h-8 bg-white/50 rounded border border-slate-300/50"></div>
                
                {/* Подушка */}
                <div className="absolute left-2 bottom-10 w-12 h-4 bg-white/70 rounded-sm border border-slate-300/50"></div>
                
                {/* Контент */}
                <div className="absolute inset-0 flex items-center justify-center p-2">
                    {status ? (
                        <div className="flex flex-col items-center gap-1 w-full">
                            <div className="flex items-center gap-1.5">
                                {status.isBooking ? <AlertCircle size={12} className="text-amber-700"/> :
                                 status.isExpired ? <AlertCircle size={12} className="text-slate-600"/> :
                                 <User size={12} className={status.debt > 0 ? 'text-rose-700' : 'text-emerald-700'}/>}
                                <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                                    {guest.fullName}
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-600">
                                {guest.days}д
                                {status.debt > 0 && !status.isCheckedOut && !status.isExpired && (
                                    <span className="ml-1 font-semibold text-rose-700">
                                        -{status.debt.toLocaleString()}
                                    </span>
                                )}
                                {status.isExpired && <span className="ml-1 font-semibold">OUT</span>}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-blue-500 transition-colors">
                            <Plus size={20}/>
                            <span className="text-[9px] font-medium">Свободно</span>
                        </div>
                    )}
                </div>
                
                {/* Бейдж яруса */}
                <div className={`absolute top-1 right-1 text-[8px] px-1.5 py-0.5 rounded font-medium ${
                    isTop ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
                }`}>
                    {isTop ? '⬆️' : '⬇️'}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
            {/* Номер кровати */}
            <div className="text-center text-xs font-semibold text-slate-600 mb-1">
                Кровать №{bedNumber}
            </div>
            
            {/* Верхний ярус */}
            {renderBed(topGuest, topStatus, true)}
            
            {/* Разделитель (лестница) */}
            <div className="h-2 flex items-center justify-center">
                <div className="w-1 h-full bg-slate-400 rounded"></div>
            </div>
            
            {/* Нижний ярус */}
            {renderBed(bottomGuest, bottomStatus, false)}
        </div>
    );
};

export default BunkBed;