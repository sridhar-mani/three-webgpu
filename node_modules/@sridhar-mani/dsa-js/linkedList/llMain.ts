import CompareFunc from '../util/compareFuncs'
import LLNode from './llnode';

export default class LinkedList<T>{
    private compare: CompareFunc<T>;
    private head: LLNode<T> | null;
    private tail: LLNode<T> | null; 
    private length: number;
    constructor(compareFunc?: (a: T, b: T) => number){
        this.compare = new CompareFunc<T>(compareFunc);
        this.head = null;
        this.tail=null
        this.length = 0;
    }

    public append(value: T):this{
        const newNode = new LLNode<T>(value);
        if(!this.head){
            this.head = this.tail= newNode

        }else if(this.tail){
            
                this.tail.next = newNode;
                this.tail = newNode;
             
        }
        this.length++
        return this
    }

    public prepend(value: T):this{
        const newNode = new LLNode<T>(value,this.head);
        this.head = newNode;

        if(!this.tail){
            this.tail = newNode
        }
        this.length++
        return this
    }

    public insert(value:T,indexTo:number):this{
        if(indexTo===0){
            this.prepend(value)
            return this
        }else if(indexTo > (this.length-1)){
            this.append(value)
            return this
        }else{
            let temp = 0;
            let currentNode = this.head;
            const newNode = new LLNode(value);
            while(temp!==indexTo && currentNode){
                currentNode = currentNode?.next;
                temp++;
            }

            if(currentNode){
                newNode.next = currentNode.next;
                currentNode.next = newNode;
                return this
            }else{
                if(this.tail){
                    this.tail.next = newNode;
                    this.tail = newNode;
                }else{
                    this.head = newNode;
                    this.tail = newNode;
                }
            }

        }
        return this
    }


    public getLength(){
        return this.length;
    }

    public delete(value:any):void |null {
        if(!this.head){
            return null
        }

        if(this.head.value===value){
            this.head = this.head.next;
            this.length--
            return
        }

        let curNode = this.head


        while(curNode.next){
            if(curNode.next.value===value){
                curNode.next=curNode.next.next
                this.length--
                return
            }
            curNode=curNode.next
        }

        return null
    }
    public find({value,callback}:{value?:T, callback?:(val:T)=>boolean}):LLNode<T> | null{
        if(!this.head){
            return null
        }

        let curNode: LLNode<T> |  null = this.head

        while(curNode ){
            if(callback?.(curNode.value)){
                return curNode
            }

            if(value!==undefined && this.compare.equal(curNode.value,value)){
                return curNode
            }

            curNode = curNode.next
        }

        return null
    }

    public deleteTail(){

        if(!this.head) return null

        const deleteTail = this.tail;

        if(this.tail===this.head){
            this.head=null
            this.tail=null
            return deleteTail
        }

        let curNode = this.head;

        while( curNode.next && curNode?.next!==this.tail){
            
                curNode=curNode.next
            
        }

        curNode.next=null

        this.tail =curNode

        return deleteTail
    }

    public  deleteHead(){
        if(!this.head) return null
        const deleteHead = this.head;

        if(this.head===this.tail){
            this.head=null;
            this.tail=null
            return deleteHead
    }

    if(this.head) this.head = this.head?.next
    
    return deleteHead
}

public getHead(){
    if(this.head) return this.head
    return null
}

public getTail(){
    if(this.tail) return this.tail
    return null
}

public  fromArray(values:Array<T>){
        values.forEach(element => this.append(element));
        return this
    }

    public  toArray(){
        const valuesList:LLNode<T>[]=[]

        let curNode = this.head
        while(curNode){
            valuesList.push(curNode)
            curNode=curNode.next
        }

        return valuesList
    }


    public toString(callback:(value:T)=> string){
        return this.toArray().map((m)=>m.toString(callback)).toString()
    }

    public  reverse(){
        let curNode = this.head;
        let prevNode:null | LLNode<T> = null;
        let nextNode:null | LLNode<T> = null;

        while(curNode){
            nextNode = curNode.next
            curNode.next = prevNode

            prevNode = curNode
            curNode = nextNode
        }

        this.tail=this.head;
        this.head = prevNode

        return this
    }

    public  clear(){
        this.head=null
        this.tail=null
        this.length=0
        return this
    }

}