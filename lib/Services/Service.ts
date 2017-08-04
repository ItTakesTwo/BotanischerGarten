import {IRepository} from "../Repositories/IRepository";
/**
 * Created by hypfer on 06.06.17.
 */
export abstract class Service {
    Repository : IRepository;
    Collection : string;
    constructor(repository : IRepository) {
        this.Repository = repository;
        this.Collection = this.getCollection();
    }
    protected abstract getCollection() : string;

    protected GetById(id : string, callback : Function) {
        this.Repository.GetById(this.Collection, id, callback);
    };
    protected GetByDbId(id : string, callback : Function) {
        this.Repository.GetByDbId(this.Collection, id, callback);
    };
    protected GetPreviousAndNextByDbId(id: string, callback: Function) {
        this.Repository.GetPreviousAndNextByDbId(this.Collection, id, callback);
    }
    /*protected GetAllByKeyValue( key: string, value: string, callback : Function) {
        this.Repository.GetAllByKeyValue(this.Collection, key, value, callback);
    };
    protected GetAll(callback : Function) {
        this.Repository.GetAll(this.Collection, callback);
    }; */
    protected Save(id: string, entity : any, callback : Function) {
        this.Repository.Save(this.Collection, id, entity, callback);
    }; //upsert
    protected DeleteById(id : string, callback : Function) {
        this.Repository.DeleteById(this.Collection, id, callback);
    }
    GetAllIds(callback : Function) {
        this.Repository.GetAllIds(this.Collection, callback);
    }
    GetRandomIds(limit : number, callback : Function) {
        this.Repository.GetRandomIds(this.Collection, limit, callback);
    }
    GetIdsLikeSearchWithLimitAndSkip(search: string, limit : number, skip : number, callback : Function) {
        this.Repository.GetIdsLikeSearchWithLimitAndSkip(this.Collection, search, limit, skip, callback);
    };
}