/**
 * Per-retailer extractor tests. Run: npm test (server).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseReceipt } from './parser';

test('Shopify template: reads name/variant/price/image, apparel hint rescues keyword-less names', () => {
  const html = `
    <html><body>
    <table class="row product"><tr>
      <td class="order-list__product-image"><img src="https://cdn.shopify.com/tee.png"/></td>
      <td class="order-list__product-description">
        <span class="order-list__item-title product__description__name">The Cashmere Crew × 1</span>
        <span class="order-list__item-variant product__description__variant">Camel / M</span>
      </td>
      <td class="order-list__price order-list__item-price">$110.00</td>
    </tr></table>
    <table class="row product"><tr>
      <td class="order-list__product-image"><img src="https://cdn.shopify.com/pant.png"/></td>
      <td class="order-list__product-description">
        <span class="product__description__name">Performance Chino</span>
        <span class="product__description__variant">Navy / 32</span>
      </td>
      <td class="order-list__item-price">$98.00</td>
    </tr></table>
    Powered by Shopify
    </body></html>`;

  // Use a brand NOT in the registry so apparelOnly is false — forcing the size
  // variant (apparel hint) to carry "The Cashmere Crew" past the filter.
  const receipt = parseReceipt({ from: 'orders@somebrand.com', subject: 'Order #1001 confirmed', html });

  assert.ok(receipt);
  assert.equal(receipt!.extractor, 'shopify');
  assert.equal(receipt!.items.length, 2);

  const crew = receipt!.items[0];
  assert.equal(crew.title, 'The Cashmere Crew — Camel / M');
  assert.equal(crew.price, 110);
  assert.equal(crew.quantity, 1);
  assert.equal(crew.imageUri, 'https://cdn.shopify.com/tee.png');

  assert.equal(receipt!.items[1].title, 'Performance Chino — Navy / 32');
  assert.equal(receipt!.items[1].price, 98);
});

test('Amazon: extracts /dp/ product links, keeps apparel, drops gadgets', () => {
  const html = `
    <html><body>
    <img src="https://m.media-amazon.com/jeans.jpg"/>
    <a href="https://www.amazon.com/dp/B011">Levi's Men's 505 Regular Fit Jeans, Black</a><span>$49.99</span>
    <img src="https://m.media-amazon.com/cable.jpg"/>
    <a href="https://www.amazon.com/dp/B022">Anker USB-C to USB-C Cable 6ft</a><span>$15.99</span>
    <a href="https://www.amazon.com/gp/product/B033">Carhartt Acrylic Watch Hat Beanie, Grey</a><span>$16.99</span>
    </body></html>`;

  const receipt = parseReceipt({
    from: 'auto-confirm@amazon.com',
    subject: 'Your Amazon.com order has shipped',
    html,
  });

  assert.ok(receipt);
  assert.equal(receipt!.extractor, 'amazon');
  assert.equal(receipt!.retailer, 'Amazon');
  const titles = receipt!.items.map((i) => i.title);
  assert.ok(titles.some((t) => /jeans/i.test(t)));
  assert.ok(titles.some((t) => /beanie/i.test(t)));
  assert.ok(!titles.some((t) => /cable/i.test(t)), 'non-apparel dropped');
  const jeans = receipt!.items.find((i) => /jeans/i.test(i.title))!;
  assert.equal(jeans.price, 49.99);
});

test('Nike: brand-specific, folds color/size into the variant', () => {
  const html = `
    <html><body>
    <table class="order-item"><tr>
      <td><img src="https://nike/airmax.jpg"></td>
      <td>
        <p class="item-title">Nike Air Max 90</p>
        <p class="item-attr">Color: White/Black</p>
        <p class="item-attr">Size: 10</p>
      </td>
      <td class="item-price">$130.00</td>
    </tr></table>
    </body></html>`;

  const receipt = parseReceipt({ from: 'orders@nike.com', subject: 'Your Nike order', html });

  assert.ok(receipt);
  assert.equal(receipt!.extractor, 'nike');
  assert.equal(receipt!.items.length, 1);
  const item = receipt!.items[0];
  assert.equal(item.title, 'Nike Air Max 90 — White/Black · 10');
  assert.equal(item.brand, 'Nike');
  assert.equal(item.price, 130);
});

test('Registry precedence: Shopify wins over generic when both could match', () => {
  // Email has BOTH Shopify markup and JSON-LD; Shopify should be chosen.
  const html = `
    <script type="application/ld+json">{"@type":"Order","acceptedOffer":[{"@type":"Offer","price":"40","itemOffered":{"@type":"Product","name":"Plain Tee"}}]}</script>
    <table class="row product"><tr>
      <td class="order-list__product-description">
        <span class="product__description__name">Striped Tee</span>
        <span class="product__description__variant">Blue / L</span>
      </td>
      <td class="order-list__item-price">$45.00</td>
    </tr></table>`;
  const receipt = parseReceipt({ from: 'orders@brand.com', subject: 'Order confirmed', html });
  assert.ok(receipt);
  assert.equal(receipt!.extractor, 'shopify');
  assert.equal(receipt!.items[0].title, 'Striped Tee — Blue / L');
});

test('Amazon plain-text falls through to generic (no product links)', () => {
  const receipt = parseReceipt({
    from: 'auto-confirm@amazon.com',
    subject: 'Your Amazon.com order',
    text: 'Wool Beanie Hat, Grey   $18.00\nUSB Cable   $9.99\nTotal   $27.99',
  });
  assert.ok(receipt);
  assert.equal(receipt!.extractor, 'generic');
  const titles = receipt!.items.map((i) => i.title);
  assert.ok(titles.some((t) => /beanie/i.test(t)));
  assert.ok(!titles.some((t) => /cable/i.test(t)));
});
