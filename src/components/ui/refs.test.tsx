import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Badge } from './badge';
import { Textarea } from './textarea';
import { Skeleton } from './skeleton';
import { Separator } from './separator';
import { Switch } from './switch';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Table, TableBody, TableCell, TableRow } from './table';

describe('ui components forward refs (React 18)', () => {
  it.each([
    ['Button', (ref: React.RefObject<HTMLElement>) => <Button ref={ref as React.RefObject<HTMLButtonElement>}>x</Button>, 'BUTTON'],
    ['Input', (ref: React.RefObject<HTMLElement>) => <Input ref={ref as React.RefObject<HTMLInputElement>} />, 'INPUT'],
    ['Label', (ref: React.RefObject<HTMLElement>) => <Label ref={ref as React.RefObject<HTMLLabelElement>}>x</Label>, 'LABEL'],
    ['Badge', (ref: React.RefObject<HTMLElement>) => <Badge ref={ref as React.RefObject<HTMLSpanElement>}>x</Badge>, 'SPAN'],
    ['Textarea', (ref: React.RefObject<HTMLElement>) => <Textarea ref={ref as React.RefObject<HTMLTextAreaElement>} />, 'TEXTAREA'],
    ['Skeleton', (ref: React.RefObject<HTMLElement>) => <Skeleton ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['Separator', (ref: React.RefObject<HTMLElement>) => <Separator ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['Switch', (ref: React.RefObject<HTMLElement>) => <Switch ref={ref as React.RefObject<HTMLButtonElement>} />, 'BUTTON'],
    ['Card', (ref: React.RefObject<HTMLElement>) => <Card ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['CardHeader', (ref: React.RefObject<HTMLElement>) => <CardHeader ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['CardTitle', (ref: React.RefObject<HTMLElement>) => <CardTitle ref={ref as React.RefObject<HTMLHeadingElement>}>t</CardTitle>, undefined],
    ['CardContent', (ref: React.RefObject<HTMLElement>) => <CardContent ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['Table', (ref: React.RefObject<HTMLElement>) => <Table ref={ref as React.RefObject<HTMLTableElement>} />, 'TABLE'],
    ['TableRow/Cell', (ref: React.RefObject<HTMLElement>) => (
      <table><TableBody><TableRow><TableCell ref={ref as React.RefObject<HTMLTableCellElement>}>c</TableCell></TableRow></TableBody></table>
    ), 'TD'],
  ])('%s', (_name, renderWithRef, expectedTag) => {
    const ref = createRef<HTMLElement>();
    render(renderWithRef(ref));
    expect(ref.current).not.toBeNull();
    if (expectedTag) expect(ref.current!.tagName).toBe(expectedTag);
  });
});
