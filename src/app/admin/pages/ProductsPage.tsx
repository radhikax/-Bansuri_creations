import { Fragment, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  AdminApiError,
  createAdminProduct,
  getAdminCategories,
  getAdminProducts,
  updateAdminProduct,
  updateAdminVariant,
  type ApiProduct,
  type ApiProductVariant,
  type CreateProductInput,
  type UpdateProductInput,
} from '../lib/adminApi';

function parseImageLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

interface ProductFormState {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  basePrice: string;
  originalPrice: string;
  imageUrl: string;
  imagesText: string;
  variantStock: string;
  variantSku: string;
}

const emptyForm: ProductFormState = {
  name: '', slug: '', description: '', categoryId: '',
  basePrice: '', originalPrice: '', imageUrl: '', imagesText: '',
  variantStock: '', variantSku: '',
};

export function ProductsPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ['admin', 'products'], queryFn: getAdminProducts });
  const categoriesQuery = useQuery({ queryKey: ['admin', 'categories'], queryFn: getAdminCategories });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });

  const createMutation = useMutation({
    mutationFn: (input: CreateProductInput) => createAdminProduct(input),
    onSuccess: () => {
      invalidateProducts();
      toast.success('Product created');
      setDialogOpen(false);
    },
    onError: (error) => setFormError(error instanceof AdminApiError ? error.message : 'Could not save product'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) => updateAdminProduct(id, input),
    onSuccess: () => {
      invalidateProducts();
      toast.success('Product updated');
      setDialogOpen(false);
    },
    onError: (error) => setFormError(error instanceof AdminApiError ? error.message : 'Could not save product'),
  });

  const variantMutation = useMutation({
    mutationFn: ({ productId, variantId, data }: {
      productId: string;
      variantId: string;
      data: { label: string; price?: number; stock: number; sku: string };
    }) => updateAdminVariant(productId, variantId, data),
    onSuccess: () => {
      invalidateProducts();
      toast.success('Variant updated');
    },
    onError: (error) => toast.error(error instanceof AdminApiError ? error.message : 'Could not update variant'),
  });

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (product: ApiProduct) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      categoryId: product.categoryId,
      basePrice: String(product.basePrice),
      originalPrice: product.originalPrice != null ? String(product.originalPrice) : '',
      imageUrl: product.imageUrl,
      imagesText: product.images.join('\n'),
      variantStock: '',
      variantSku: '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const images = parseImageLines(form.imagesText);

    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        input: {
          name: form.name,
          description: form.description,
          categoryId: form.categoryId,
          basePrice: Number(form.basePrice),
          originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
          imageUrl: form.imageUrl,
          images,
        },
      });
    } else {
      createMutation.mutate({
        name: form.name,
        slug: form.slug,
        description: form.description,
        categoryId: form.categoryId,
        basePrice: Number(form.basePrice),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
        imageUrl: form.imageUrl,
        images,
        variants: [{ label: 'Default', stock: Number(form.variantStock), sku: form.variantSku }],
      });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  if (productsQuery.isPending || categoriesQuery.isPending) {
    return <p className="text-muted-foreground">Loading products…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl">Products</h1>
        <Button onClick={openCreate}>+ New product</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Base price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productsQuery.data?.map((product) => (
            <Fragment key={product.id}>
              <TableRow>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.category.name}</TableCell>
                <TableCell>₹{product.basePrice}</TableCell>
                <TableCell>
                  <Badge variant={product.isActive ? 'default' : 'secondary'}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(product)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}
                  >
                    {expandedId === product.id ? 'Hide variants' : 'Variants'}
                  </Button>
                </TableCell>
              </TableRow>
              {expandedId === product.id && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <VariantSubTable
                      product={product}
                      saving={variantMutation.isPending}
                      onSave={(variant, data) => variantMutation.mutate({ productId: product.id, variantId: variant.id, data })}
                    />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit product' : 'New product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            {!editingProduct && (
              <div className="space-y-1.5">
                <Label htmlFor="p-slug">Slug</Label>
                <Input id="p-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="p-description">Description</Label>
              <Input id="p-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-category">Category</Label>
              <Select value={form.categoryId} onValueChange={(value) => setForm({ ...form, categoryId: value })}>
                <SelectTrigger id="p-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categoriesQuery.data?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-basePrice">Base price (₹)</Label>
                <Input id="p-basePrice" type="number" min="1" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-originalPrice">Original price (₹, optional)</Label>
                <Input id="p-originalPrice" type="number" min="1" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-imageUrl">Cover image URL</Label>
              <Input id="p-imageUrl" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-images">Gallery image URLs (one per line)</Label>
              <Textarea id="p-images" value={form.imagesText} onChange={(e) => setForm({ ...form, imagesText: e.target.value })} rows={3} />
            </div>
            {!editingProduct && (
              <div className="grid grid-cols-2 gap-3 border-t pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="p-variantStock">Default variant stock</Label>
                  <Input id="p-variantStock" type="number" min="0" value={form.variantStock} onChange={(e) => setForm({ ...form, variantStock: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-variantSku">Default variant SKU</Label>
                  <Input id="p-variantSku" value={form.variantSku} onChange={(e) => setForm({ ...form, variantSku: e.target.value })} required />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface VariantSubTableProps {
  product: ApiProduct;
  saving: boolean;
  onSave: (variant: ApiProductVariant, data: { label: string; price?: number; stock: number; sku: string }) => void;
}

function VariantSubTable({ product, saving, onSave }: VariantSubTableProps) {
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');

  const startEdit = (variant: ApiProductVariant) => {
    setEditingVariantId(variant.id);
    setLabel(variant.label);
    setPrice(variant.price != null ? String(variant.price) : '');
    setStock(String(variant.stock));
    setSku(variant.sku);
  };

  const handleSave = (variant: ApiProductVariant) => {
    onSave(variant, { label, price: price ? Number(price) : undefined, stock: Number(stock), sku });
    setEditingVariantId(null);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {product.variants.map((variant) =>
          editingVariantId === variant.id ? (
            <TableRow key={variant.id}>
              <TableCell><Input value={label} onChange={(e) => setLabel(e.target.value)} aria-label={`Label for ${variant.sku}`} /></TableCell>
              <TableCell><Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`Price for ${variant.sku}`} /></TableCell>
              <TableCell><Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} aria-label={`Stock for ${variant.sku}`} /></TableCell>
              <TableCell><Input value={sku} onChange={(e) => setSku(e.target.value)} aria-label={`SKU for ${variant.sku}`} /></TableCell>
              <TableCell className="text-right">
                <Button size="sm" disabled={saving} onClick={() => handleSave(variant)}>Save</Button>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow key={variant.id}>
              <TableCell>{variant.label}</TableCell>
              <TableCell>{variant.price ?? '—'}</TableCell>
              <TableCell>{variant.stock}</TableCell>
              <TableCell>{variant.sku}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => startEdit(variant)}>Edit</Button>
              </TableCell>
            </TableRow>
          ),
        )}
      </TableBody>
    </Table>
  );
}
