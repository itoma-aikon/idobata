// This file is maintained for backward compatibility
// It re-exports all components from the base sheet
// New code should import directly from the specialized components:
// - For navigation: import from '../ui/navigation/menu-sheet'
// - For chat: import from '../ui/chat/chat-sheet'
// - For generic sheets: import from '../ui/base/sheet'

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "./base/sheet";

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
