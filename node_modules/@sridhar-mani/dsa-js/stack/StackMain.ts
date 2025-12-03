import LinkedList from '../linkedList/llMain'

export default class StackMain<T>{
    private linkedList:LinkedList<T>;

    constructor(){
        this.linkedList = new LinkedList();
    }

    public isEmpty(){
        return !this.linkedList.getHead
    }

    public peek(){
        if(!this.linkedList.getHead) return null

        return this.linkedList.getHead()
    }

    public push(value:T){
        this.linkedList.prepend(value)
    }

    public pop(value:T){
        this.linkedList.append(value)
    }

    public toArray(){
        return this.linkedList.toArray()
    }

    public toString(callBack:(value: T) => string){
        return this.linkedList.toString(callBack)
    }

    
}