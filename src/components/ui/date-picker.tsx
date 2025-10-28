"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { CalendarIcon } from "@lucide/react";
import { ptBR } from "date-fns/locale";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
  date?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
}

export function DatePicker({ date, onChange, placeholder = "Selecionar data" }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <DayPicker
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange?.(d);
            setOpen(false);
          }}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}
