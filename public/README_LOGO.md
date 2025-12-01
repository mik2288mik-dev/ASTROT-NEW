# Инструкция по добавлению логотипа

## Добавление файла logo.jpg

1. Поместите файл `logo.jpg` (или `logo.png`) в эту директорию
2. Файл автоматически будет использоваться в компоненте Loading

## Для интеграции logo.jpg в компонент Loading:

Откройте `/workspace/components/ui/Loading.tsx` и замените строку:

```tsx
<div className="text-6xl font-bold text-white font-serif">
    A
</div>
```

На:

```tsx
<img 
    src="/logo.png" 
    alt="ASTROT" 
    className="w-20 h-20 object-contain"
/>
```

Примечание: Если у логотипа есть фон, рекомендуется использовать формат PNG с прозрачным фоном.
