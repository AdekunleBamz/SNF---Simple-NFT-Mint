import { Footer } from '../src/Footer';

describe('Footer', () => {
  it('should return footer HTML', () => {
    const footer = Footer();
    expect(footer).toContain('© 2024 SNF NFT Mint');
  });
});
