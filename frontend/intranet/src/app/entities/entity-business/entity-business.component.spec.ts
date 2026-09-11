import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityBusinessComponent } from './entity-business.component';

describe('EntityBusinessComponent', () => {
  let component: EntityBusinessComponent;
  let fixture: ComponentFixture<EntityBusinessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityBusinessComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityBusinessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
