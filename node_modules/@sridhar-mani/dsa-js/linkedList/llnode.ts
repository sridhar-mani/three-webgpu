export default class LLNode<T>{
    value: T;
    next: LLNode<T> | null;

    constructor(value:T,next: LLNode<T>|null=null){
        this.value=value;
        this.next=next
    }

    toString(callbackFunc?:(value:T)=>string):string{
        return callbackFunc?callbackFunc(this.value):`${this.value}`;
    }
}