# 📦 JS-DSA (Linked List Library)

A **TypeScript-based Linked List implementation** for both frontend and backend use. This library provides easy-to-use **Singly Linked List** and **Doubly Linked List** implementations with common operations like insertion, deletion, search, and traversal.

## 🚀 Features
- ✅ **Append & Prepend** elements efficiently
- ✅ **Insert** at any index
- ✅ **Delete** elements or nodes
- ✅ **Find** elements by value or condition
- ✅ **Reverse** the linked list
- ✅ **Convert to/from arrays**
- ✅ **String representation** of linked list
- ✅ **Delete Head** of linked list
- ✅ **Delete Tail** of linked list
- ✅ **Clear** all nodes of the list

---

## 📖 What is a Linked List?

A **linked list** is a data structure consisting of **nodes**, where each node contains:
1. A **value**
2. A **pointer (reference) to the next node** in the list
3. In a **Doubly Linked List**, each node also has a **pointer to the previous node**

Unlike arrays, **linked lists do not require contiguous memory allocation**, making insertion and deletion more efficient in many cases.

📺 **Visualize Linked Lists Here**: [Visualgo.net](https://visualgo.net/en/list)

---

## 📦 Installation

### **Using npm**
```sh
npm install @sridhar-mani/js-dsa
```

## 📚 Usage

### **Import the Library**
```typescript
import { LinkedList, DoubelLinkedList } from "@sridhar-mani/js-dsa";
```

### 📌 **Singly Linked List Example**
```typescript
const list = new LinkedList<number>();
list.append(1);
list.append(2);
list.append(3);

console.log(list.toArray()); // Output: [1, 2, 3]

list.reverse();
console.log(list.toArray()); // Output: [3, 2, 1]
```

### 📌 **Doubly Linked List Example**
```typescript
const dll = new DoubelLinkedList<number>();
dll.append(10);
dll.append(20);
dll.append(30);

console.log(dll.toArray()); // Output: [10, 20, 30]

dll.reverse();
console.log(dll.toArray()); // Output: [30, 20, 10]
```

## 🔄 API Methods

### **Common Methods (Both SLL & DLL)**

| Method | Description |
|--------|-------------|
| `.append(value)` | Adds a node to the end |
| `.prepend(value)` | Adds a node to the beginning |
| `.insert(value, index)` | Inserts a node at a given index |
| `.delete(value)` | Deletes the first occurrence of the value |
| `.find({value, callback})` | Returns the node with the given value |
| `.reverse()` | Reverses the linked list |
| `.toArray()` | Converts the list into an array |
| `.toString(callback)` | Returns a string representation of the list |
| `.deleteHead()` | Deletes the head of the list |
| `.deleteTail()` | Deletes the tail of the list |
| `.clear()` | Clears all nodes from the list |
| `.getLength()` | Returns the length of the list |
| `.fromArray(array)` | Creates list from array of values |

## 🛠 Development & Contribution

### **Clone the repo:**
```sh
git clone https://github.com/sridhar-mani/js-dsa.git
```

### **Install dependencies:**
```sh
npm install
```

### **Build the package:**
```sh
npm run build
```

## 📜 License
This project is licensed under the MIT License.