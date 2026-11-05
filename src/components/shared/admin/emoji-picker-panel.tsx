import EmojiPicker, { Categories, EmojiStyle, Theme } from "emoji-picker-react";

const categories = [
  { category: Categories.SUGGESTED, name: "Frequentes" },
  { category: Categories.SMILEYS_PEOPLE, name: "Rostos e pessoas" },
  { category: Categories.ANIMALS_NATURE, name: "Animais e natureza" },
  { category: Categories.FOOD_DRINK, name: "Comidas e bebidas" },
  { category: Categories.TRAVEL_PLACES, name: "Viagens e lugares" },
  { category: Categories.ACTIVITIES, name: "Atividades" },
  { category: Categories.OBJECTS, name: "Objetos" },
  { category: Categories.SYMBOLS, name: "Símbolos" },
  { category: Categories.FLAGS, name: "Bandeiras" },
];

export function EmojiPickerPanel({
  onSelect,
  width = 320,
}: {
  onSelect: (emoji: string) => void;
  width?: number | string;
}) {
  return (
    <EmojiPicker
      theme={Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      lazyLoadEmojis
      skinTonesDisabled
      width={width}
      height={380}
      searchPlaceholder="Buscar emoji"
      categories={categories}
      previewConfig={{ showPreview: false }}
      onEmojiClick={(emoji) => onSelect(emoji.emoji)}
    />
  );
}
