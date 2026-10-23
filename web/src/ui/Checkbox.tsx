import { Checkbox as Base, Flex, Text } from '@radix-ui/themes'

export function Checkbox({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string }) {
  return (
    <Text as="label" size="2">
      <Flex as="span" align="center" gap="2">
        <Base checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
        {label}
      </Flex>
    </Text>
  )
}
