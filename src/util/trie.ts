export { Trie };

class TrieNode<KeyT, ValueT> {
  private children: Map<KeyT, TrieNode<KeyT, ValueT>>;
  private value?: ValueT;
  private subtreeSize = 0;

  constructor() {
    this.children = new Map();
  }

  getValue(): ValueT | undefined {
    return this.value;
  }

  setValue(value: ValueT): void {
    if (this.value === undefined) {
      this.subtreeSize++;
    }
    this.value = value;
  }

  clearValue(): void {
    if (this.value !== undefined) {
      this.subtreeSize--;
    }
    this.value = undefined;
  }

  size(): number {
    return this.subtreeSize;
  }

  visit(
    keys: Iterator<KeyT>,
    path: KeyT[],
    visitor: (path: KeyT[], node: TrieNode<KeyT, ValueT>) => boolean,
    createMissing = false
  ): boolean {
    const visitChild = (
      childKey: KeyT,
      childNode: TrieNode<KeyT, ValueT>
    ): boolean | undefined => {
      const prevSize = childNode.subtreeSize;

      path.push(childKey);
      const visitResult = childNode.visit(keys, path, visitor, createMissing);
      path.pop();

      this.subtreeSize += childNode.subtreeSize - prevSize;
      if (childNode.subtreeSize === 0) {
        // Remove empty subtree
        this.children.delete(childKey);
      }
      if (!visitResult) {
        return false;
      }
    };

    const key = keys.next();
    if (key.done) {
      if (!visitor(path, this)) {
        return false;
      }
      for (const [childKey, childNode] of this.children.entries()) {
        const visitResult = visitChild(childKey, childNode);
        if (visitResult !== undefined) {
          return visitResult;
        }
      }
      return true;
    }

    const childKey: KeyT = key.value!;
    let childNode = this.children.get(childKey);
    if (childNode === undefined && createMissing) {
      const newChild = new TrieNode<KeyT, ValueT>();
      this.children.set(childKey, newChild);
      childNode = newChild;
    }

    if (childNode !== undefined) {
      const visitResult = visitChild(childKey, childNode);
      if (visitResult !== undefined) {
        return visitResult;
      }
    }
    return true;
  }
}

class Trie<KeyT, ValueT> {
  private root = new TrieNode<KeyT, ValueT>();

  constructor(items?: Iterable<[Iterable<KeyT>, ValueT]>) {
    if (items === undefined) {
      return;
    }
    for (const [keys, value] of items) {
      this.insert(keys, value);
    }
  }

  lookup(keys: Iterable<KeyT>): ValueT | undefined {
    let result: ValueT | undefined = undefined;
    this.root.visit(keys[Symbol.iterator](), [], (path, node) => {
      result = node.getValue();
      return false;
    });
    return result;
  }

  insert(keys: Iterable<KeyT>, value: ValueT): void {
    this.root.visit(
      keys[Symbol.iterator](),
      [],
      (path, node) => {
        node.setValue(value);
        return false;
      },
      true
    );
  }

  remove(keys: Iterable<KeyT>): void {
    this.root.visit(keys[Symbol.iterator](), [], (path, node) => {
      node.clearValue();
      return false;
    });
  }

  clear(): void {
    this.root = new TrieNode<KeyT, ValueT>();
  }

  size(): number {
    return this.root.size();
  }

  visit(
    keys: Iterable<KeyT>,
    visitor: (path: KeyT[], value: ValueT) => boolean
  ): void {
    this.root.visit(keys[Symbol.iterator](), [], (path, node) => {
      const value = node.getValue();
      if (value !== undefined) {
        return visitor(path, value);
      }
      return true;
    });
  }
}
