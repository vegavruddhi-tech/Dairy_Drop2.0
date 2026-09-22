import { requireMilkman } from '@/auth/session.js';
import * as productService from '@/services/product.service.js';

import { PageHeader, EmptyState } from '@/components/ui/index.jsx';
import { ProductEditor, ProductList, AddPresets } from '@/components/milkman/Catalog.jsx';

export const metadata = { title: 'Catalog' };

export default async function CatalogPage() {
  const actor = await requireMilkman();
  const products = await productService.listCatalog(actor);

  return (
    <>
      <PageHeader
        title="Catalog"
        description="Extras your customers can order with their milk."
        action={<ProductEditor />}
      />

      {products.length === 0 ? (
        <EmptyState
          icon="🧈"
          title="Nothing in your catalog"
          description="Add the usual dairy items in one tap, then set your prices and stock."
          action={<AddPresets />}
        />
      ) : (
        <ProductList products={products} />
      )}
    </>
  );
}
