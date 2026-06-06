/**
 * Parser tests. Run: npm run test (server). Uses node:test via tsx.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractJsonLd, htmlToText, parseReceipt } from './parser';

test('JSON-LD Order: extracts line items, brand, price, image, currency', () => {
  const html = `
    <html><head>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Order",
      "orderNumber": "BNB-10231",
      "priceCurrency": "USD",
      "acceptedOffer": [
        {
          "@type": "Offer",
          "price": "89.00",
          "itemOffered": {
            "@type": "Product",
            "name": "Stretch Chino Pant - Stone",
            "brand": { "@type": "Brand", "name": "Bonobos" },
            "image": "https://img.example/chino.jpg"
          }
        },
        {
          "@type": "Offer",
          "price": "49.00",
          "itemOffered": { "@type": "Product", "name": "Cotton Oxford Shirt - White" }
        }
      ]
    }
    </script></head>
    <body>Thanks for your order!</body></html>`;

  const receipt = parseReceipt({
    from: 'orders@bonobos.com',
    subject: 'Your Bonobos order is confirmed',
    html,
  });

  assert.ok(receipt, 'should parse a receipt');
  assert.equal(receipt!.retailer, 'Bonobos');
  assert.equal(receipt!.orderId, 'BNB-10231');
  assert.equal(receipt!.currency, 'USD');
  assert.equal(receipt!.items.length, 2);

  const chino = receipt!.items[0];
  assert.equal(chino.title, 'Stretch Chino Pant - Stone');
  assert.equal(chino.brand, 'Bonobos');
  assert.equal(chino.price, 89);
  assert.equal(chino.imageUri, 'https://img.example/chino.jpg');

  // Brand falls back to the retailer when the product omits it.
  assert.equal(receipt!.items[1].brand, 'Bonobos');
});

test('Plain-text receipt: pairs apparel lines with prices, drops noise', () => {
  const text = [
    'Thanks for your order #12345',
    'Merino V-Neck Sweater - Forest Green   $49.90',
    'Slim Fit Jeans - Indigo   $79.00',
    'Subtotal   $128.90',
    'Shipping   $0.00',
    'Tax   $10.31',
    'Total   $139.21',
  ].join('\n');

  const receipt = parseReceipt({
    from: 'receipts@uniqlo.com',
    subject: 'Order confirmation',
    text,
  });

  assert.ok(receipt);
  assert.equal(receipt!.retailer, 'Uniqlo');
  const titles = receipt!.items.map((i) => i.title);
  assert.deepEqual(titles, ['Merino V-Neck Sweater - Forest Green', 'Slim Fit Jeans - Indigo']);
  assert.equal(receipt!.items[0].price, 49.9);
  assert.equal(receipt!.items[1].price, 79);
  // Noise lines (subtotal/shipping/tax/total) must not appear.
  assert.ok(!titles.some((t) => /total|shipping|tax/i.test(t)));
});

test('Mixed retailer (Amazon): keeps apparel, drops non-apparel', () => {
  const text = [
    'Your Amazon.com order',
    'Levi’s 511 Slim Jeans, Black   $59.50',
    'USB-C Charging Cable 6ft   $12.99',
    'Wireless Mouse   $24.99',
    'Wool Beanie Hat, Grey   $18.00',
  ].join('\n');

  const receipt = parseReceipt({
    from: 'auto-confirm@amazon.com',
    subject: 'Your Amazon.com order has shipped',
    text,
  });

  assert.ok(receipt);
  const titles = receipt!.items.map((i) => i.title);
  assert.ok(titles.some((t) => /jeans/i.test(t)));
  assert.ok(titles.some((t) => /beanie/i.test(t)));
  assert.ok(!titles.some((t) => /cable|mouse/i.test(t)), 'non-apparel filtered out');
});

test('Non-order email returns null', () => {
  const receipt = parseReceipt({
    from: 'news@uniqlo.com',
    subject: 'New arrivals just dropped',
    text: 'Check out our latest collection of shirts and jackets!',
  });
  assert.equal(receipt, null);
});

test('Order email with no recognizable items returns null', () => {
  const receipt = parseReceipt({
    from: 'orders@somestore.com',
    subject: 'Your order confirmation',
    text: 'Subtotal $10\nShipping $5\nTotal $15',
  });
  assert.equal(receipt, null);
});

test('htmlToText strips tags and decodes entities', () => {
  const out = htmlToText('<p>Navy &amp; White Shirt</p><div>$25</div>');
  assert.ok(out.includes('Navy & White Shirt'));
  assert.ok(out.includes('$25'));
});

test('extractJsonLd ignores malformed blocks', () => {
  const html =
    '<script type="application/ld+json">{ bad json }</script>' +
    '<script type="application/ld+json">{"@type":"Product","name":"Tee"}</script>';
  const blocks = extractJsonLd(html);
  assert.equal(blocks.length, 1);
});

test('currency inferred from symbol when JSON-LD omits it', () => {
  const receipt = parseReceipt({
    from: 'orders@everlane.com',
    subject: 'Order confirmed',
    text: 'The Cashmere Crew - Camel   £110.00',
  });
  assert.ok(receipt);
  assert.equal(receipt!.currency, 'GBP');
});
