export default class DoubleLLNode<T>{
    value: T;
    prev: DoubleLLNode<T> | null;
    next: DoubleLLNode<T> | null;

    constructor(value:T, next:DoubleLLNode<T>|null=null,prev:DoubleLLNode<T>|null=null){
        this.value= value;
        this.next = next;
        this.prev=prev;
    }

    toString(callbackFunc:(value:T)=>string):string{
        return callbackFunc? callbackFunc(this.value) : `${this.value}`;
    }
}