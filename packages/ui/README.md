# @buzrr/ui

Shared UI components for Buzrr.

## InputField

Input (and optional textarea) component with the same styling and behavior as the original web form field. Use inside a `<form>` when using server actions so `useFormStatus()` works.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `type` | `string` | Input type (e.g. `"text"`, `"number"`, `"file"`) |
| `name` | `string` | Form field name |
| `placeholder` | `string` | Placeholder text |
| `autoComplete` | `string` | Autocomplete attribute |
| `className` | `string` | Extra Tailwind classes |
| `required` | `boolean` | Required field |
| `variant` | `"default" \| "playerName" \| "question"` | Visual style (replaces legacy `style` prop) |
| `size` | `"sm" \| "md" \| "lg"` | Size variant |
| `textarea` | `boolean` | Render as textarea |
| `label` | `string` | Label text |
| `labelClass` | `string` | Label className |
| `fieldValue` | `string` | Controlled initial/value |
| `onTitleChange` | `(value: string) => void` | Change callback |
| `maxLength` | `number` | Max length (default 50, 100 for textarea) |
| `maxNum` | `number` | Max value for number type |
| `accept` | `string` | Accept for file input |
| `error` | `boolean` | Error state |
| `errorMessage` | `string` | Error message below field |
| `disabled` | `boolean` | Disabled state |

### Variations

- **variant**
  - `default` – full width, rounded-full
  - `playerName` – bordered, rounded-lg, focus border blue
  - `question` – narrower width (w-4/5), rounded-full
- **size**
  - `sm` – smaller padding and text
  - `md` – default
  - `lg` – larger padding and text
- **error** – red border and optional `errorMessage`
- **disabled** – reduced opacity and not-allowed cursor

### Usage

```tsx
import { InputField } from "@buzrr/ui";

<InputField
  type="text"
  name="title"
  placeholder="Enter title"
  autoComplete="off"
  className="text-dark dark:text-white dark:bg-dark border rounded-xl"
  label="Title"
  required
/>
```

With variations:

```tsx
<InputField variant="playerName" size="lg" label="Player name" ... />
<InputField error errorMessage="This field is required" ... />
<InputField disabled ... />
```
