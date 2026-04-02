import { useEffect, useRef } from 'react';

interface UseSwipeBackOptions {
    onSwipeBack: () => void;
    enabled?: boolean;
    threshold?: number; // минимальное расстояние свайпа в px
    edgeWidth?: number; // ширина зоны от края для начала свайпа
}

/**
 * Хук для свайпа назад от левого края экрана
 * Работает как в iOS - свайп от левого края возвращает назад
 */
export function useSwipeBack({
    onSwipeBack,
    enabled = true,
    threshold = 80,
    edgeWidth = 30
}: UseSwipeBackOptions) {
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isSwipeFromEdge = useRef(false);

    useEffect(() => {
        if (!enabled) return;

        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            touchStartX.current = touch.clientX;
            touchStartY.current = touch.clientY;

            // Проверяем, начался ли свайп от левого края
            isSwipeFromEdge.current = touch.clientX <= edgeWidth;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!isSwipeFromEdge.current) return;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartX.current;
            const deltaY = Math.abs(touch.clientY - touchStartY.current);

            // Свайп вправо от левого края, с учётом что вертикальный свайп не должен срабатывать
            if (deltaX > threshold && deltaY < threshold) {
                onSwipeBack();
            }

            isSwipeFromEdge.current = false;
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [enabled, threshold, edgeWidth, onSwipeBack]);
}
